import prisma from '../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const users = await prisma.user.findMany()
    return {
      status: 'success',
      data: users
    }
  } catch (error) {
    // اضافه کردن این خط برای دیدن ارور در ترمینال سرور
    console.error('❌ REAL DATABASE ERROR:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'خطا در ارتباط با دیتابیس'
    })
  }
})