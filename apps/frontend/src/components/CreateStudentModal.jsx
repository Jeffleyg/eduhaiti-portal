import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslation } from 'react-i18next'
import { sanitizeText } from '../lib/string.js'
import { useCallback, useMemo } from 'react'
import FormField from './form/FormField'
import SelectField from './form/SelectField'
import Button from './Button'

const PHONE_PATTERN = /^\+?[\d\s().-]{8,20}$/

/** Optional guardian phone: empty is fine, otherwise it must look like a phone number. */
const optionalPhone = (message) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || PHONE_PATTERN.test(value), message)
    .transform((value) => value || undefined)

/**
 * Zod Schema para validação de Aluno
 * Fornece validação em tempo real com mensagens localizadas
 */
const createStudentSchema = z.object({
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
    .enum(['MALE', 'FEMALE', 'OTHER'], {
      error: "validation.genderRequired",
    }),

  fatherName: z
    .string()
    .max(100, "validation.fatherNameMax")
    .optional()
    .nullable()
    .transform(v => v || null),

  motherName: z
    .string()
    .max(100, "validation.motherNameMax")
    .optional()
    .nullable()
    .transform(v => v || null),

  // Telefones dos responsáveis: SMS de faltas, gateway SMS/IVR e acesso da família.
  fatherPhone: optionalPhone("validation.fatherPhoneInvalid"),
  motherPhone: optionalPhone("validation.motherPhoneInvalid"),

  classId: z
    .string()
    .min(1, "validation.classRequired"),
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
function CreateStudentModal({ onClose, onSubmit: onSubmitProp, loading, classes }) {
  const { t } = useTranslation()

  // Preparar opções de classes
  const classOptions = useMemo(
    () =>
      classes.map((item) => ({
        value: item.id,
        label: `${sanitizeText(item.name)} (${sanitizeText(item.level)})`,
      })),
    [classes]
  )

  // Preparar opções de gênero
  const genderOptions = [
    { value: 'MALE', label: t('genderMale') || 'Masculino' },
    { value: 'FEMALE', label: t('genderFemale') || 'Feminino' },
    { value: 'OTHER', label: t('genderOther') || 'Outro' },
  ]

  // Inicializar form com schema Zod
  const {
    control,
    handleSubmit,
    reset,
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
      fatherPhone: '',
      motherPhone: '',
      classId: '',
    },
  })

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
        {/* Email */}
        <FormField
          control={control}
          name="email"
          label={t('email') || 'Email'}
          type="email"
          placeholder={t('enterEmail') || 'E.g. student@school.ht'}
          required
          error={errors.email?.message}
          hint={t('emailHint') || 'Email will be used for login'}
        />

        {/* First Name */}
        <FormField
          control={control}
          name="firstName"
          label={t('firstName') || 'First Name'}
          type="text"
          placeholder={t('enterFirstName') || 'E.g. John'}
          required
          error={errors.firstName?.message}
          hint={t('firstNameHint') || 'Minimum 2 characters'}
        />

        {/* Last Name */}
        <FormField
          control={control}
          name="lastName"
          label={t('lastName') || 'Last Name'}
          type="text"
          placeholder={t('enterLastName') || 'E.g. Silva'}
          required
          error={errors.lastName?.message}
          hint={t('lastNameHint') || 'Minimum 2 characters'}
        />

        {/* Date of Birth */}
        <FormField
          control={control}
          name="dateOfBirth"
          label={t('dateOfBirth') || 'Date of Birth'}
          type="date"
          required
          error={errors.dateOfBirth?.message}
        />

        {/* Address */}
        <FormField
          control={control}
          name="address"
          label={t('address') || 'Address'}
          type="text"
          placeholder={t('enterAddress') || 'E.g. Main Street, 123'}
          required
          error={errors.address?.message}
          hint={t('addressHint') || 'Complete address'}
          className="md:col-span-2"
        />

        {/* Gender */}
        <SelectField
          control={control}
          name="gender"
          label={t('gender') || 'Gender'}
          options={genderOptions}
          placeholder={t('selectGender') || 'Select...'}
          required
          error={errors.gender?.message}
        />

        {/* Father Name */}
        <FormField
          control={control}
          name="fatherName"
          label={t('fatherName') || 'Father Name (optional)'}
          type="text"
          placeholder={t('enterFatherName') || 'E.g. John Silva'}
          error={errors.fatherName?.message}
        />

        {/* Mother Name */}
        <FormField
          control={control}
          name="motherName"
          label={t('motherName') || 'Mother Name (optional)'}
          type="text"
          placeholder={t('enterMotherName') || 'E.g. Maria Silva'}
          error={errors.motherName?.message}
        />

        {/* Father Phone */}
        <FormField
          control={control}
          name="fatherPhone"
          label={t('fatherPhone') || "Father's phone"}
          type="tel"
          placeholder="+509 3700 0000"
          error={errors.fatherPhone?.message}
          hint={t('guardianPhoneHint') || 'Used for absence SMS and family access'}
        />

        {/* Mother Phone */}
        <FormField
          control={control}
          name="motherPhone"
          label={t('motherPhone') || "Mother's phone"}
          type="tel"
          placeholder="+509 3700 0000"
          error={errors.motherPhone?.message}
          hint={t('guardianPhoneHint') || 'Used for absence SMS and family access'}
        />

        {/* Class */}
        <SelectField
          control={control}
          name="classId"
          label={t('class') || 'Class'}
          options={classOptions}
          placeholder={t('selectClass') || 'Select a class...'}
          required
          error={errors.classId?.message}
          hint={t('classHint') || 'Class in which the student will be enrolled'}
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
          {t('cancel') || 'Cancel'}
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading || isSubmitting}
          disabled={loading || isSubmitting}
        >
          {t('createStudentAction') || 'Create Student'}
        </Button>
      </div>
    </form>
  )
}

export default CreateStudentModal

