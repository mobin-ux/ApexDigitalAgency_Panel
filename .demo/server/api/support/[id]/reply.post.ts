import { defineEventHandler, readBody, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const ticketId = event.context.params?.id
  const body = await readBody(event)

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticketId!,
      content: body.content,
      isAdmin: false // مشتری پاسخ می‌دهد
    }
  })

  // آپدیت زمان تیکت برای اینکه بیاید بالا
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date(), status: 'OPEN' }
  })

  return { status: 'success', message }
})