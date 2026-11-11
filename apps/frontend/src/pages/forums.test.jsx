import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithRouter } from "../test/utils.jsx"

vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "tok" }) }))
vi.mock("../lib/api.js", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))

import { apiFetch } from "../lib/api.js"
import ProfessorForum from "./professor/ProfessorForum.jsx"
import StudentForum from "./student/StudentForum.jsx"

const classes = [
  { id: "c1", name: "3e A" },
  { id: "c2", name: "3e B" },
]
const threadsByClass = {
  c1: [{ id: "t1", title: "Fractions", postsCount: 2 }],
  c2: [],
}
const details = {
  thread: { title: "Fractions", body: "Let's talk" },
  posts: [
    { id: "p1", body: "Reply one", createdBy: { name: "Ana" } },
    { id: "p2", body: "Reply two" },
  ],
}

describe.each([
  ["ProfessorForum", ProfessorForum],
  ["StudentForum", StudentForum],
])("%s", (_name, Page) => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  const routes = (overrides = {}) =>
    apiFetch.mockImplementation(async (path, options = {}) => {
      const key = `${options.method ?? "GET"} ${path}`
      if (key in overrides) {
        const v = overrides[key]
        if (v instanceof Error) throw v
        return typeof v === "function" ? v() : v
      }
      if (path === "/classes/my-classes") return classes
      const threadMatch = path.match(/^\/forums\/class\/(\w+)\/threads$/)
      if (threadMatch) return threadsByClass[threadMatch[1]]
      if (path === "/forums/threads/t1/posts") return details
      return {}
    })

  it("loads threads, opens a discussion and switches classes", async () => {
    routes()
    renderWithRouter(<Page />)
    expect(await screen.findByText("Fractions")).toBeInTheDocument()
    expect(screen.getByText("selectTopicToViewDiscussion")).toBeInTheDocument()
    await userEvent.click(screen.getByText("Fractions"))
    expect(await screen.findByText("Let's talk")).toBeInTheDocument()
    expect(screen.getByText("Reply one")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c2" } })
    expect(await screen.findByText("noTopicsInClass")).toBeInTheDocument()
    expect(screen.getByText("selectTopicToViewDiscussion")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } })
    await waitFor(() => expect(screen.getByText("noTopicsInClass")).toBeInTheDocument())
  })

  it("creates threads and posts", async () => {
    routes({
      "POST /forums/class/c1/threads": {},
      "POST /forums/threads/t1/posts": {},
      "GET /forums/threads/t1/posts": { thread: details.thread, posts: [] },
    })
    renderWithRouter(<Page />)
    await screen.findByText("Fractions")

    await userEvent.click(screen.getByText("publishThread"))
    expect(apiFetch).not.toHaveBeenCalledWith("/forums/class/c1/threads", expect.objectContaining({ method: "POST" }))
    fireEvent.change(screen.getByPlaceholderText("threadTitlePlaceholder"), { target: { value: "New" } })
    fireEvent.change(screen.getByPlaceholderText("threadInitialMessagePlaceholder"), { target: { value: "Body" } })
    await userEvent.click(screen.getByText("publishThread"))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/forums/class/c1/threads", {
        method: "POST",
        token: "tok",
        body: { title: "New", body: "Body" },
      }),
    )

    await userEvent.click(screen.getByText("Fractions"))
    expect(await screen.findByText("noResponsesYet")).toBeInTheDocument()
    await userEvent.click(screen.getByText("sendResponse"))
    fireEvent.change(screen.getByPlaceholderText("replyPlaceholder"), { target: { value: "My reply" } })
    await userEvent.click(screen.getByText("sendResponse"))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/forums/threads/t1/posts", {
        method: "POST",
        token: "tok",
        body: { body: "My reply" },
      }),
    )
  })

  it("reports errors from every request", async () => {
    routes({ "POST /forums/class/c1/threads": new Error("thread error"), "POST /forums/threads/t1/posts": new Error("post error") })
    renderWithRouter(<Page />)
    await screen.findByText("Fractions")
    fireEvent.change(screen.getByPlaceholderText("threadTitlePlaceholder"), { target: { value: "New" } })
    fireEvent.change(screen.getByPlaceholderText("threadInitialMessagePlaceholder"), { target: { value: "Body" } })
    await userEvent.click(screen.getByText("publishThread"))
    expect(await screen.findByText("thread error")).toBeInTheDocument()

    await userEvent.click(screen.getByText("Fractions"))
    await screen.findByText("Let's talk")
    fireEvent.change(screen.getByPlaceholderText("replyPlaceholder"), { target: { value: "x" } })
    await userEvent.click(screen.getByText("sendResponse"))
    expect(await screen.findByText("post error")).toBeInTheDocument()
  })

  it("reports load errors for threads and posts", async () => {
    routes({ "GET /forums/threads/t1/posts": new Error("posts error") })
    const first = renderWithRouter(<Page />)
    await userEvent.click(await screen.findByText("Fractions"))
    expect(await screen.findByText("posts error")).toBeInTheDocument()
    first.unmount()

    routes({ "GET /forums/class/c1/threads": new Error("threads error") })
    const second = renderWithRouter(<Page />)
    expect(await screen.findByText("threads error")).toBeInTheDocument()
    second.unmount()

    routes({ "GET /classes/my-classes": new Error("classes error") })
    renderWithRouter(<Page />)
    expect(await screen.findByText("classes error")).toBeInTheDocument()
  })

  it("handles users without classes and null payloads", async () => {
    routes({ "GET /classes/my-classes": null })
    renderWithRouter(<Page />)
    expect(await screen.findByText("noTopicsInClass")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("threadTitlePlaceholder"), { target: { value: "x" } })
    fireEvent.change(screen.getByPlaceholderText("threadInitialMessagePlaceholder"), { target: { value: "y" } })
    await userEvent.click(screen.getByText("publishThread"))
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it("ignores topics without id", async () => {
    routes({ "GET /forums/class/c1/threads": [{ title: "Orphan", postsCount: 0 }] })
    renderWithRouter(<Page />)
    await userEvent.click(await screen.findByText("Orphan"))
    expect(screen.getByText("selectTopicToViewDiscussion")).toBeInTheDocument()
  })

  it("treats a null thread list as empty", async () => {
    routes({ "GET /forums/class/c1/threads": null })
    renderWithRouter(<Page />)
    expect(await screen.findByText("noTopicsInClass")).toBeInTheDocument()
  })

  it("shows the loader", () => {
    apiFetch.mockImplementation(() => new Promise(() => {}))
    renderWithRouter(<Page />)
    expect(screen.getByText("loading")).toBeInTheDocument()
  })
})
