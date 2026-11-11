import React, { useCallback, useMemo } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslation } from "react-i18next"
import { sanitizeText } from "../lib/string.js"
import FormField from "./form/FormField"
import SelectField from "./form/SelectField"
import Button from "./Button"

/**
 * Zod Schema para validação de Professor
 * Garante tipagem rigorosa e campos compatíveis com a API do NestJS
 */
const createTeacherSchema = z.object({
  email: z
    .string()
    .min(1, "validation.emailRequired")
    .email("validation.emailInvalid"),
  firstName: z
    .string()
    .min(2, "validation.firstNameMin")
    .max(100, "validation.firstNameMax"),
  lastName: z
    .string()
    .min(2, "validation.lastNameMin")
    .max(100, "validation.lastNameMax"),
  dateOfBirth: z
    .string()
    .min(1, "validation.dateOfBirthRequired"),
  address: z
    .string()
    .min(5, "validation.addressMin")
    .max(255, "validation.addressMax"),
  gender: z
    .enum(["MALE", "FEMALE", "OTHER"], {
      error: "validation.genderRequired",
    }),
  fatherName: z
    .string()
    .max(100, "validation.fatherNameMax")
    .optional()
    .nullable()
    .transform((v) => v || null),
  motherName: z
    .string()
    .max(100, "validation.motherNameMax")
    .optional()
    .nullable()
    .transform((v) => v || null),
  subjects: z
    .string()
    .min(2, "validation.subjectsRequired"),
  classIds: z
    .array(z.string())
    .optional()
    .default([]),
  newClasses: z
    .array(
      z.object({
        name: z.string(),
        level: z.string(),
      })
    )
    .optional()
    .default([]),
})

function CreateTeacherModal({
  onClose,
  onSubmit: onSubmitProp,
  loading,
  classes = [],
  teacherData = {},
}) {
  const { t } = useTranslation()

  // Opções de turmas já cadastradas
  const classOptions = useMemo(
    () =>
      classes.map((item) => ({
        value: item.id,
        label: `${sanitizeText(item.name)} (${sanitizeText(item.level)})`,
      })),
    [classes]
  )

  const genderOptions = [
    { value: "MALE", label: t("genderMale") || "Masculino" },
    { value: "FEMALE", label: t("genderFemale") || "Feminino" },
    { value: "OTHER", label: t("genderOther") || "Outro" },
  ]

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createTeacherSchema),
    mode: "onBlur",
    defaultValues: {
      email: teacherData.email || "",
      firstName: teacherData.firstName || "",
      lastName: teacherData.lastName || "",
      dateOfBirth: teacherData.dateOfBirth || "",
      address: teacherData.address || "",
      gender: teacherData.gender || "MALE",
      fatherName: teacherData.fatherName || "",
      motherName: teacherData.motherName || "",
      subjects: Array.isArray(teacherData.subjects)
        ? teacherData.subjects.join(", ")
        : teacherData.subjects || "",
      classIds: teacherData.classIds || [],
      newClasses: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "newClasses",
  })

  const onSubmit = useCallback(
    async (formData) => {
      try {
        const subjectsArray = formData.subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)

        const filteredNewClasses = (formData.newClasses || []).filter(
          (c) => c.name && c.name.trim().length > 0
        )

        await onSubmitProp({
          ...formData,
          subjects: subjectsArray,
          newClasses: filteredNewClasses,
        })
        reset()
      } catch (error) {
        console.error("Falha ao criar professor:", error)
      }
    },
    [onSubmitProp, reset]
  )

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-3 md:grid-cols-2">
        {/* Email */}
        <FormField
          control={control}
          name="email"
          label={t("email") || "Email"}
          type="email"
          placeholder={t("enterEmail") || "professeur@ecole.ht"}
          required
          error={errors.email?.message}
        />

        {/* Gênero */}
        <SelectField
          control={control}
          name="gender"
          label={t("gender") || "Sexe"}
          options={genderOptions}
          placeholder={t("selectGender") || "Chwazi sèks..."}
          required
          error={errors.gender?.message}
        />

        {/* Primeiro Nome */}
        <FormField
          control={control}
          name="firstName"
          label={t("firstName") || "Prenom"}
          type="text"
          placeholder="Ex: Jean"
          required
          error={errors.firstName?.message}
        />

        {/* Sobrenome */}
        <FormField
          control={control}
          name="lastName"
          label={t("lastName") || "Nom de famille"}
          type="text"
          placeholder="Ex: Baptiste"
          required
          error={errors.lastName?.message}
        />

        {/* Data de Nascimento */}
        <FormField
          control={control}
          name="dateOfBirth"
          label={t("dateOfBirth") || "Date de naissance"}
          type="date"
          required
          error={errors.dateOfBirth?.message}
        />

        {/* Disciplinas */}
        <FormField
          control={control}
          name="subjects"
          label={t("subjects") || "Disciplines"}
          type="text"
          placeholder={t("subjectsExample")}
          required
          error={errors.subjects?.message}
          hint={t("separateWithCommas")}
        />

        {/* Endereço */}
        <FormField
          control={control}
          name="address"
          label={t("address") || "Adresse"}
          type="text"
          placeholder="Ex: Delmas 31, Port-au-Prince"
          required
          error={errors.address?.message}
          className="md:col-span-2"
        />

        {/* Filiação (Opcional) */}
        <FormField
          control={control}
          name="fatherName"
          label={t("fatherName") || "Nom du père"}
          type="text"
          placeholder={t("optional")}
          error={errors.fatherName?.message}
        />

        <FormField
          control={control}
          name="motherName"
          label={t("motherName") || "Nom de la mère"}
          type="text"
          placeholder={t("optional")}
          error={errors.motherName?.message}
        />
      </div>

      {/* Turmas já cadastradas */}
      {classOptions.length > 0 && (
        <fieldset className="pt-2 border-t border-slate-100">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("existingClasses")}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {classOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-brand-navy">
                <input type="checkbox" value={option.value} {...register("classIds")} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Novas Turmas Adicionais Dinâmicas */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("newClasses") || "Nouvelles classes"}
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: "", level: "" })}
          >
            + {t("addClass") || "Ajouter une classe"}
          </Button>
        </div>

        {fields.length > 0 && (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-center">
                <input
                  {...register(`newClasses.${index}.name`)}
                  placeholder={t("className") || "Nom de la classe (ex: 3eme-B)"}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <input
                  {...register(`newClasses.${index}.level`)}
                  placeholder={t("classLevel") || "Niveau (ex: 3eme)"}
                  className="w-1/3 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2 justify-end pt-3">
        <Button
          type="button"
          variant="secondary"
          onClick={handleClose}
          disabled={loading || isSubmitting}
        >
          {t("cancel") || "Annuler"}
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading || isSubmitting}
          disabled={loading || isSubmitting}
        >
          {t("createTeacherAction") || "Enregistrer"}
        </Button>
      </div>
    </form>
  )
}

export default CreateTeacherModal