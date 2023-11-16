'use server'

import { z } from 'zod'
import { sql } from '@vercel/postgres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { signIn } from '@/auth'

export type State = {
  errors?: {
    customerId?: string[],
    amount?: string[],
    status?: string[],
  },
  message?: string | null
}

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer'
  }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.'}),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status'
  }),
  date: z.string()
})

const CreateInvoice = FormSchema.omit({ id: true, date: true })
const UpdateInvoice = FormSchema.omit({ id: true, date: true })

export async function createInvoice(prevState: State, formData: FormData) {
  const rawFormData = {
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  }

  // const rawFormData = Object.fromEntries(formData.entries())
  // console.log(rawFormData)

  const validatedFields = CreateInvoice.safeParse(rawFormData)
  console.log(validatedFields)
  if(!validatedFields.success){
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice'
    }
  }

  const { customerId, amount, status } = validatedFields.data
  const amountInCents = amount * 100
  const date = new Date().toISOString().split('T')[0]

  try{
  await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `
  }catch(error){
    return {
      message: 'Database Error: Failed to create invoice'
    }
  }

  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}

export async function updateInvoice(id: string, formData: FormData) {
  const rawFormData = {
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  }

  const { customerId, amount, status } = UpdateInvoice.parse(rawFormData)
  const amountInCents = amount * 100

  try{
  await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `
  }catch(error){
    return {
      message: 'Database Error: Failed to create invoice'
    }
  }

  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}

export async function deleteInvoice(id: string) {
  throw new Error('failed to dalete invoice')
  try{
    await sql`DELETE FROM invoices WHERE id = ${id}`
    revalidatePath('/dashboard/invoices')
    return { message: 'Deleted Invoice.' }
  }catch(error){
    return {
      message: 'Database Error: Failed to create invoice'
    }
  }

}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
){
  console.log('login form data:', formData)
  try{
    await signIn('credentials', Object.fromEntries(formData))
  }catch(error){
    if((error as Error).message.includes('CredentialsSignin')){
      return 'CredentialSignin'
    }
    throw error;
  }
}