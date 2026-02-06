import { defineEventHandler, getCookie, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const ticketId = event.context.params?.id
  
  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' }
  })

  return { messages }
})