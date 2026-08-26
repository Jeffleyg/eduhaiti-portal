import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslation } from 'react-i18next'
import { sanitizeText } from '../lib/string.js'
import { useCallback, useMemo } from 'react'
import FormField from './form/FormField'
import SelectField from './form/SelectField'
import Button from './Button'

/**
 * Zod Schema para validação de Aluno
 * Fornece validação em tempo real com mensagens localizadas
 */
const createStudentSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email deve ser válido'),

  firstName: z
    .string()
    .min(2, 'Primeiro nome deve ter pelo menos 2 caracteres')
    .max(100, 'Primeiro nome não pode ter mais de 100 caracteres'),

  lastName: z
    .string()
    .min(2, 'Último nome deve ter pelo menos 2 caracteres')
    .max(100, 'Último nome não pode ter mais de 100 caracteres'),

  dateOfBirth: z
    .string()
    .min(1, 'Data de nascimento é obrigatória'),

  address: z
    .string()
    .min(5, 'Endereço deve ter pelo menos 5 caracteres')
    .max(255, 'Endereço não pode ter mais de 255 caracteres'),

  gender: z
    .enum(['MALE', 'FEMALE', 'OTHER'], {
      errorMap: () => ({ message: 'Selecione um gênero válido' }),
    }),

  fatherName: z
    .string()
    .max(100, 'Nome do pai não pode ter mais de 100 caracteres')
    .optional()
    .nullable()
    .transform(v => v || null),

  motherName: z
    .string()
    .max(100, 'Nome da mãe não pode ter mais de 100 caracteres')
    .optional()
    .nullable()
    .transform(v => v || null),

  classId: z
    .string()
    .min(1, 'Selecione uma turma'),
})

/**
 * CreateStudentModal - Modal refatorado com react-hook-form + Zod
 * 
 * ✅ Validação em tempo real
 * ✅ Mensagens de erro inline
 * ✅ Acessibilidade WCAG 2.1 AA
 * ✅ FormField com aria-labels
 * ✅ SelectField com Radix UI
 */
function CreateStudentModal({ onClose, onSubmit: onSubmitProp, loading, classes, academicYears = [] }) {
  const { t } = useTranslation()
  
    // Inicializar form com schema Zod
    const {
      control,
      handleSubmit,
      reset,
      watch,
      formState: { errors, isSubmitting },
    } = useForm({
      resolver: zodResolver(createStudentSchema),
      mode: 'onBlur', // Validar ao sair do campo
      defaultValues: {
        email: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        address: '',
        gender: '',
        fatherName: '',
        motherName: '',
        classId: '',
      },
    })
  
    const selectedYear = watch('academicYearId')

  // Preparar opções de classes
  const filteredClasses = useMemo(() => {
    if (!selectedYear) return classes
    return classes.filter((c) => c.academicYearId === selectedYear || (c.academicYear && c.academicYear.id === selectedYear))
  }, [classes, selectedYear])

  const classOptions = useMemo(
    () =>
      filteredClasses.map((item) => ({
        value: item.id,
        label: `${sanitizeText(item.name)} (${sanitizeText(item.level)})`,
      })),
    [filteredClasses]
  )

  // Preparar opções de gênero
  const genderOptions = [
    { value: 'MALE', label: t('genderMale') },
    { value: 'FEMALE', label: t('genderFemale') },
    { value: 'OTHER', label: t('genderOther') },
  ]

  

  // Callback ao submeter
  const onSubmit = useCallback(
    async (data) => {
      try {
        await onSubmitProp(data)
        reset() // Limpar form após sucesso
      } catch (error) {
        console.error('Failed to create student:', error)
      }
    },
    [onSubmitProp, reset]
  )

  // Callback ao fechar
  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-3 md:grid-cols-2">
        {/* Academic Year / Period */}
        <SelectField
          control={control}
          name="academicYearId"
          label={t('academicYear')}
          options={academicYears.map(y => ({ value: y.id, label: y.year }))}
          placeholder={t('selectAcademicYear')}
          className="md:col-span-2"
        />
        {/* Email */}
        <FormField
          control={control}
          name="email"
          label={t('email')}
          type="email"
          placeholder={t('enterEmail')}
          required
          error={errors.email?.message}
          hint={t('emailHint')}
        />

        {/* First Name */}
        <FormField
          control={control}
          name="firstName"
          label={t('firstName')}
          type="text"
          placeholder={t('enterFirstName')}
          required
          error={errors.firstName?.message}
          hint={t('firstNameHint')}
        />

        {/* Last Name */}
        <FormField
          control={control}
          name="lastName"
          label={t('lastName')}
          type="text"
          placeholder={t('enterLastName')}
          required
          error={errors.lastName?.message}
          hint={t('lastNameHint')}
        />

        {/* Date of Birth */}
        <FormField
          control={control}
          name="dateOfBirth"
          label={t('dateOfBirth')}
          type="date"
          required
          error={errors.dateOfBirth?.message}
        />

        {/* Address */}
        <FormField
          control={control}
          name="address"
          label={t('address')}
          type="text"
          placeholder={t('enterAddress')}
          required
          error={errors.address?.message}
          hint={t('addressHint')}
          className="md:col-span-2"
        />

        {/* Gender */}
        <SelectField
          control={control}
          name="gender"
          label={t('gender')}
          options={genderOptions}
          placeholder={t('selectGender')}
          required
          error={errors.gender?.message}
        />

        {/* Father Name */}
        <FormField
          control={control}
          name="fatherName"
          label={t('fatherName')}
          type="text"
          placeholder={t('enterFatherName')}
          error={errors.fatherName?.message}
        />

        {/* Mother Name */}
        <FormField
          control={control}
          name="motherName"
          label={t('motherName')}
          type="text"
          placeholder={t('enterMotherName')}
          error={errors.motherName?.message}
        />

        {/* Class */}
        <SelectField
          control={control}
          name="classId"
          label={t('class')}
          options={classOptions}
          placeholder={t('selectClass')}
          required
          error={errors.classId?.message}
          hint={t('classHint')}
          className="md:col-span-2"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={handleClose}
          disabled={loading || isSubmitting}
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={loading || isSubmitting}
          disabled={loading || isSubmitting}
        >
          {t('createStudentAction')}
        </Button>
      </div>
    </form>
  )
}

export default CreateStudentModal

