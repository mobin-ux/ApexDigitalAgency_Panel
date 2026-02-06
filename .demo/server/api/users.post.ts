import prisma from '../utils/prisma'

export default defineEventHandler(async (event) => {
  // خواندن بدنه درخواست (Body)
  const body = await readBody(event)

  // اعتبارسنجی ساده (بعدا با Zod کامل‌ترش می‌کنیم)
  if (!body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ایمیل الزامی است'
    })
  }

  try {
    // ذخیره در دیتابیس
    const newUser = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name || null,
      }
    })

    return {
      status: 'created',
      user: newUser
    }
  } catch (error) {
    return {
      status: 'error',
      message: 'این ایمیل قبلا ثبت شده است یا خطایی رخ داده.'
    }
  }
})
