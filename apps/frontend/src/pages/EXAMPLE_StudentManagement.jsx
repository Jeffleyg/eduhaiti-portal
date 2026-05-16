// Example: Modern Student Management Page
// This demonstrates best practices using the new component system

import React, { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react"
import {
  Button,
  FormField,
  Card,
  Badge,
  EmptyState,
  Alert,
  ListItemCard,
  SkeletonLoader,
  useToast,
  Tabs,
  Progress,
  Divider
} from "@/components"

/**
 * StudentManagement - Modern page example
 * Demonstrates best practices for the new UI system
 */
export default function StudentManagement() {
  // State management
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { showToast } = useToast()

  // Effects
  useEffect(() => {
    loadStudents()
  }, [])

  // API Calls
  const loadStudents = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/students")
      const data = await response.json()
      setStudents(data)
    } catch (error) {
      showToast({
        type: "error",
        title: "Erro ao carregar",
        message: "Não foi possível carregar os alunos"
      })
    } finally {
      setLoading(false)
    }
  }

  const deleteStudent = async (studentId) => {
    try {
      await fetch(`/api/admin/students/${studentId}`, { method: "DELETE" })
      setStudents(prev => prev.filter(s => s.id !== studentId))
      showToast({
        type: "success",
        title: "Aluno deletado",
        message: "O aluno foi removido do sistema"
      })
    } catch (error) {
      showToast({
        type: "error",
        title: "Erro",
        message: "Não foi possível deletar o aluno"
      })
    }
    setShowDeleteConfirm(false)
  }

  // Filtering and Sorting
  const filteredStudents = students
    .filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           student.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesFilter = filterStatus === "all" || student.status === filterStatus
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "email") return a.email.localeCompare(b.email)
      if (sortBy === "date") return new Date(b.createdAt) - new Date(a.createdAt)
      return 0
    })

  // Stats
  const stats = {
    total: students.length,
    active: students.filter(s => s.status === "active").length,
    inactive: students.filter(s => s.status === "inactive").length,
    pending: students.filter(s => s.status === "pending").length,
  }

  // Render: Loading
  if (loading) {
    return (
      <div className="container-responsive py-xl">
        <h1 className="text-headline mb-xl">Alunos</h1>
        <div className="space-y-lg">
          <SkeletonLoader count={5} type="card" />
        </div>
      </div>
    )
  }

  // Render: Main Page
  return (
    <div className="container-responsive py-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-2xl">
        <div>
          <h1 className="text-headline mb-md">Gestão de Alunos</h1>
          <p className="text-body text-gray-600">
            {filteredStudents.length} aluno(s) encontrado(s)
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={Plus}
          onClick={() => navigate("/admin/students/new")}
        >
          Novo Aluno
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-2xl">
        <Card>
          <div className="text-center">
            <p className="text-body text-gray-600">Total</p>
            <p className="text-3xl font-bold text-brand-navy mt-md">{stats.total}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-body text-gray-600">Ativos</p>
            <p className="text-3xl font-bold text-success mt-md">{stats.active}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-body text-gray-600">Inativos</p>
            <p className="text-3xl font-bold text-danger mt-md">{stats.inactive}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-body text-gray-600">Pendentes</p>
            <p className="text-3xl font-bold text-warning mt-md">{stats.pending}</p>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="mb-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          <FormField
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={Search}
          />
          <FormField
            type="select"
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Ativos" },
              { value: "inactive", label: "Inativos" },
              { value: "pending", label: "Pendentes" },
            ]}
          />
          <FormField
            type="select"
            label="Ordenar por"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: "name", label: "Nome (A-Z)" },
              { value: "email", label: "Email" },
              { value: "date", label: "Mais recente" },
            ]}
          />
        </div>
      </Card>

      {/* Empty State */}
      {filteredStudents.length === 0 && (
        <EmptyState
          title="Nenhum aluno encontrado"
          description={
            searchTerm || filterStatus !== "all"
              ? "Tente ajustar seus filtros de busca"
              : "Comece adicionando seu primeiro aluno ao sistema"
          }
          action={!searchTerm && filterStatus === "all" ? () => navigate("/admin/students/new") : null}
          actionLabel="Adicionar Aluno"
        />
      )}

      {/* Student List */}
      {filteredStudents.length > 0 && (
        <div className="space-y-lg">
          {filteredStudents.map(student => (
            <ListItemCard
              key={student.id}
              title={student.name}
              subtitle={student.email}
              status={
                student.status === "active" ? "Ativo" :
                student.status === "inactive" ? "Inativo" : "Pendente"
              }
              statusColor={
                student.status === "active" ? "green" :
                student.status === "inactive" ? "gray" : "yellow"
              }
              badge={
                <Badge variant={student.status === "active" ? "success" : "warning"}>
                  {student.class}
                </Badge>
              }
              preview={
                <div className="grid grid-cols-3 gap-lg text-center">
                  <div>
                    <p className="text-xs text-gray-600">Matrícula</p>
                    <p className="text-sm font-bold">{student.enrollment}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Presença</p>
                    <p className="text-sm font-bold">{student.attendance}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Média</p>
                    <p className="text-sm font-bold">{student.grade}</p>
                  </div>
                </div>
              }
              onEdit={() => navigate(`/admin/students/${student.id}`)}
              onDelete={() => {
                setSelectedStudent(student)
                setShowDeleteConfirm(true)
              }}
              onClick={() => navigate(`/admin/students/${student.id}`)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedStudent && (
        <Card
          className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 rounded-none"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-title mb-lg">Confirmar exclusão</h2>
            <p className="text-body text-gray-600 mb-2xl">
              Tem certeza que deseja deletar <strong>{selectedStudent.name}</strong>?
            </p>
            <Alert variant="warning">
              Esta ação não pode ser desfeita. Todos os dados do aluno serão removidos.
            </Alert>
            <div className="flex gap-lg justify-end mt-xl">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => deleteStudent(selectedStudent.id)}
              >
                Deletar
              </Button>
            </div>
          </Card>
        </Card>
      )}
    </div>
  )
}
