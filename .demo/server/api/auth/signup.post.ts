import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  // ۱. دریافت اطلاعات از بدنه درخواست
  const body = await readBody(event)
  const { email, password, name } = body

  // ۲. اعتبارسنجی ورودی‌ها (Validation)
  if (!email || !password || !name) {
    throw createError({ statusCode: 400, statusMessage: 'لطفاً نام، ایمیل و رمز عبور را وارد کنید.' })
  }

  // ۳. قانون امنیتی رمز عبور (حداقل ۸ کاراکتر)
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
  }

  // ۴. چک کردن تکراری نبودن ایمیل
  const existingUser = await prisma.user.findUnique({
    where: { email: email }
  })

  if (existingUser) {
    throw createError({ statusCode: 400, statusMessage: 'این ایمیل قبلاً ثبت شده است.' })
  }

  // ۵. هش کردن رمز عبور (Hashing)
  const hashedPassword = await bcrypt.hash(password, 10)

  // ۶. ساخت کاربر در دیتابیس
  const newUser = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: 'USER',       // امنیت: همیشه نقش کاربر عادی داده شود
      status: 'ACTIVE',   // فعلاً فعال است
      avatar: '/img/avatars/placeholder.svg' // عکس پیش‌فرض
    }
  })

  // ۷. بازگشت پاسخ موفقیت
  return {
    status: 'success',
    message: 'ثبت نام با موفقیت انجام شد.',
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name
    }
  }
})