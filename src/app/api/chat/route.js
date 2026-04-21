import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveRelevantChunks } from '@/lib/rag'
import { anthropic } from '@/lib/anthropic'

export async function POST(req) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { message, conversationId, selectedDocumentIds = [] } = await req.json()

        if (!message?.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        if (selectedDocumentIds.length === 0) {
            return NextResponse.json(
                { error: 'Please select at least one document to chat with' },
                { status: 400 }
            )
        }

        // Retrieve relevant chunks from selected documents only
        const relevantChunks = await retrieveRelevantChunks(
            message,
            session.user.id,
            selectedDocumentIds,
            5
        )

        // Fetch selected document names for system prompt
        const selectedDocs = await prisma.document.findMany({
            where: {
                id: { in: selectedDocumentIds },
                userId: session.user.id,
            },
            select: { id: true, name: true },
        })

        const docNames = selectedDocs.map((d) => d.name).join(', ')

        const context = relevantChunks.length > 0
            ? relevantChunks
                .map((c, i) => `[Source ${i + 1} - ${c.documentName}]\n${c.content}`)
                .join('\n\n')
            : null

        // Get or create conversation
        let conversation
        if (conversationId) {
            conversation = await prisma.conversation.findFirst({
                where: { id: conversationId, userId: session.user.id },
                include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
            })
        }

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    title: message.slice(0, 50),
                    userId: session.user.id,
                },
                include: { messages: true },
            })
        }

        // Save user message
        await prisma.message.create({
            data: {
                role: 'user',
                content: message,
                conversationId: conversation.id,
            },
        })

        const history = (conversation.messages || []).map((m) => ({
            role: m.role,
            content: m.content,
        }))

        const systemPrompt = context
            ? `You are a helpful assistant answering questions based on the following documents: ${docNames}.
Always base your answers strictly on the provided context. If the answer is not in the context, say so clearly.
Be concise and accurate. Cite which source document your answer comes from when relevant.

CONTEXT FROM SELECTED DOCUMENTS:
${context}`
            : `You are a helpful assistant. No relevant content was found in the selected documents (${docNames}) for this query. Let the user know and suggest they rephrase their question.`

        const stream = await anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                ...history,
                { role: 'user', content: message },
            ],
        })

        const encoder = new TextEncoder()
        let fullResponse = ''

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversationId: conversation.id })}\n\n`)
                    )

                    for await (const chunk of stream) {
                        if (
                            chunk.type === 'content_block_delta' &&
                            chunk.delta.type === 'text_delta'
                        ) {
                            const text = chunk.delta.text
                            fullResponse += text
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
                            )
                        }
                    }

                    await prisma.message.create({
                        data: {
                            role: 'assistant',
                            content: fullResponse,
                            conversationId: conversation.id,
                        },
                    })

                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                    )
                    controller.close()
                } catch (err) {
                    controller.error(err)
                }
            },
        })

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch (error) {
        console.error('Chat error:', error)
        return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 })
    }
}

export async function GET(req) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const conversationId = searchParams.get('id')

        // Fetch single conversation messages
        if (conversationId) {
            const conversation = await prisma.conversation.findFirst({
                where: { id: conversationId, userId: session.user.id },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                    },
                },
            })

            if (!conversation) {
                return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
            }

            return NextResponse.json({ messages: conversation.messages })
        }

        // Fetch all conversations list
        const conversations = await prisma.conversation.findMany({
            where: { userId: session.user.id },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                updatedAt: true,
                _count: { select: { messages: true } },
            },
        })

        return NextResponse.json({ conversations })
    } catch (error) {
        console.error('Fetch conversations error:', error)
        return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }
}

export async function DELETE(req) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const conversationId = searchParams.get('id')

        if (!conversationId) {
            return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
        }

        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId: session.user.id },
        })

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        await prisma.conversation.delete({ where: { id: conversationId } })

        return NextResponse.json({ message: 'Conversation deleted successfully' })
    } catch (error) {
        console.error('Delete conversation error:', error)
        return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
    }
}