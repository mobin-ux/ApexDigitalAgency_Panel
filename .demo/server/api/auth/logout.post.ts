export default defineEventHandler((event) => {
  // پاک کردن کوکی احراز هویت
  deleteCookie(event, 'auth_token')
  
  return {
    status: 'success',
    message: 'خروج با موفقیت انجام شد'
  }
})
