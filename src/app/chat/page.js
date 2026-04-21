'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function ChatPage() {
    const { data: session } = useSession()
    const router = useRouter()

    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [conversationId, setConversationId] = useState(null)
    const [conversations, setConversations] = useState([])
    const [documents, setDocuments] = useState([])
    const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
    const [activeMenuId, setActiveMenuId] = useState(null)

    const menuRef = useRef(null)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        fetchConversations()
        fetchDocuments()
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setActiveMenuId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fetchConversations = async () => {
        try {
            const res = await fetch('/api/chat')
            const data = await res.json()
            setConversations(data.conversations || [])
        } catch (err) {
            console.error('Failed to fetch conversations', err)
        }
    }

    const fetchMessages = async (convId) => {
        try {
            const res = await fetch(`/api/chat?id=${convId}`)
            const data = await res.json()
            setMessages(data.messages || [])
        } catch (err) {
            console.error('Failed to fetch messages', err)
        }
    }

    const fetchDocuments = async () => {
        try {
            const res = await fetch('/api/documents')
            const data = await res.json()
            setDocuments(data.documents || [])
        } catch (err) {
            console.error('Failed to fetch documents', err)
        }
    }

    const toggleDocument = (docId) => {
        setSelectedDocumentIds((prev) =>
            prev.includes(docId)
                ? prev.filter((id) => id !== docId)
                : [...prev, docId]
        )
        // Reset chat when document selection changes
        setMessages([])
        setConversationId(null)
    }

    const startNewChat = () => {
        setMessages([])
        setConversationId(null)
        setInput('')
    }

    const handleSubmit = async (e) => {
        e?.preventDefault()
        const trimmed = input.trim()
        if (!trimmed || loading) return

        const userMessage = { role: 'user', content: trimmed }
        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setLoading(true)

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    conversationId,
                    selectedDocumentIds,
                }),
            })

            if (!res.ok) throw new Error('Failed to send message')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let assistantText = ''

            setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

                for (const line of lines) {
                    const jsonStr = line.replace('data: ', '')
                    try {
                        const parsed = JSON.parse(jsonStr)
                        if (parsed.type === 'conversation_id') {
                            setConversationId(parsed.conversationId)
                            fetchConversations()
                        } else if (parsed.type === 'text') {
                            assistantText += parsed.text
                            setMessages((prev) => {
                                const updated = [...prev]
                                updated[updated.length - 1] = {
                                    role: 'assistant',
                                    content: assistantText,
                                }
                                return updated
                            })
                        }
                    } catch {
                        // ignore partial chunk parse errors
                    }
                }
            }
        } catch (err) {
            console.error('Chat error:', err)
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Something went wrong. Please try again.' },
            ])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const handleDeleteConversation = async (e, convId) => {
        e.stopPropagation()
        setActiveMenuId(null)

        try {
            await fetch(`/api/chat?id=${convId}`, { method: 'DELETE' })
            setConversations((prev) => prev.filter((c) => c.id !== convId))
            if (conversationId === convId) {
                setConversationId(null)
                setMessages([])
            }
        } catch (err) {
            console.error('Failed to delete conversation', err)
        }
    }

    const hasDocuments = documents.length > 0
    const hasSelection = selectedDocumentIds.length > 0
    const canChat = hasSelection && !loading

    return (
        <div className="min-h-screen bg-gray-950 flex">
            {/* Sidebar */}
            <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">R</div>
                    <span className="text-white font-semibold text-sm">RAG Doc Q&A</span>
                </div>

                {/* Document selector */}
                <div className="p-3 border-b border-gray-800">
                    <p className="text-gray-400 text-xs uppercase tracking-wider px-1 mb-2">
                        Select Documents
                    </p>
                    {!hasDocuments ? (
                        <div className="px-1">
                            <p className="text-gray-600 text-xs">No documents uploaded yet.</p>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-blue-400 hover:text-blue-300 text-xs mt-1 transition-colors cursor-pointer"
                            >
                                Upload from Dashboard →
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                            {documents.map((doc) => {
                                const isSelected = selectedDocumentIds.includes(doc.id)
                                return (
                                    <button
                                        key={doc.id}
                                        onClick={() => toggleDocument(doc.id)}
                                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer ${isSelected
                                            ? 'bg-blue-600/20 border border-blue-500/40'
                                            : 'hover:bg-gray-800 border border-transparent'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${isSelected
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-gray-600'
                                            }`}>
                                            {isSelected && (
                                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className={`text-xs truncate ${isSelected ? 'text-blue-300' : 'text-gray-400'}`}>
                                            {doc.name}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {hasSelection && (
                        <p className="text-blue-400 text-xs px-1 mt-2">
                            {selectedDocumentIds.length} document{selectedDocumentIds.length > 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>

                {/* New chat button */}
                <div className="p-3">
                    <button
                        onClick={startNewChat}
                        disabled={!hasSelection}
                        className={`w-full py-2 px-3 text-sm font-medium rounded-lg transition-colors ${hasSelection
                            ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        + New Chat
                    </button>
                </div>

                {/* Conversation history */}
                <div className="flex-1 overflow-y-auto px-3 pb-3" ref={menuRef}>
                    <p className="text-gray-600 text-xs uppercase tracking-wider px-1 mb-2">Recent</p>
                    {conversations.length === 0 ? (
                        <p className="text-gray-600 text-xs px-1">No conversations yet</p>
                    ) : (
                        conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`group relative flex items-center mb-1 rounded-lg transition-colors ${conversationId === conv.id
                                    ? 'bg-gray-800'
                                    : 'hover:bg-gray-800'
                                    }`}
                            >
                                {/* Conversation button */}
                                <button
                                    onClick={() => {
                                        setConversationId(conv.id)
                                        setActiveMenuId(null)
                                        fetchMessages(conv.id)
                                    }}
                                    className={`flex-1 text-left px-3 py-2 text-sm truncate pr-8 cursor-pointer ${conversationId === conv.id
                                        ? 'text-white'
                                        : 'text-gray-400 group-hover:text-white'
                                        }`}
                                >
                                    {conv.title || 'Untitled'}
                                </button>

                                {/* 3-dot menu button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveMenuId(activeMenuId === conv.id ? null : conv.id)
                                    }}
                                    className={`absolute right-1 p-1.5 rounded-md text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-colors cursor-pointer ${activeMenuId === conv.id
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="5" cy="12" r="2" />
                                        <circle cx="12" cy="12" r="2" />
                                        <circle cx="19" cy="12" r="2" />
                                    </svg>
                                </button>

                                {/* Dropdown menu */}
                                {activeMenuId === conv.id && (
                                    <div className="absolute right-0 top-8 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                                        <button
                                            onClick={(e) => handleDeleteConversation(e, conv.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 border-t border-gray-800">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-2 px-3 text-gray-400 hover:text-white text-sm border border-gray-700 hover:border-gray-500 rounded-lg transition-colors cursor-pointer"
                    >
                        ← Documents
                    </button>
                </div>
            </aside>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col">
                {/* Selected docs header bar */}
                {hasSelection && (
                    <div className="px-6 py-2 bg-blue-600/10 border-b border-blue-500/20 flex items-center gap-2">
                        <span className="text-blue-400 text-xs">Chatting with:</span>
                        <div className="flex gap-2 flex-wrap">
                            {selectedDocumentIds.map((id) => {
                                const doc = documents.find((d) => d.id === id)
                                return doc ? (
                                    <span key={id} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                        {doc.name}
                                    </span>
                                ) : null
                            })}
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="text-5xl mb-4">💬</div>
                            {!hasDocuments ? (
                                <>
                                    <h2 className="text-xl font-semibold text-white mb-2">No documents yet</h2>
                                    <p className="text-gray-500 text-sm max-w-sm mb-4">
                                        Upload documents from the Dashboard first, then come back to chat.
                                    </p>
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors cursor-pointer"
                                    >
                                        Go to Dashboard
                                    </button>
                                </>
                            ) : !hasSelection ? (
                                <>
                                    <h2 className="text-xl font-semibold text-white mb-2">Select a document to start</h2>
                                    <p className="text-gray-500 text-sm max-w-sm">
                                        Choose one or more documents from the sidebar, then ask anything about them.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-xl font-semibold text-white mb-2">Ask anything</h2>
                                    <p className="text-gray-500 text-sm max-w-sm">
                                        Claude will answer based on the selected document{selectedDocumentIds.length > 1 ? 's' : ''}.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6">
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                                            }`}
                                    >
                                        {msg.content || (
                                            <span className="flex gap-1 items-center text-gray-400">
                                                <span className="animate-bounce">●</span>
                                                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                                                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input area */}
                <div className="border-t border-gray-800 bg-gray-900 px-6 py-4">
                    <div className="max-w-3xl mx-auto">
                        {!hasSelection ? (
                            <div className="text-center py-3 text-gray-500 text-sm">
                                ← Select a document from the sidebar to start chatting
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-3 items-end">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask a question about your selected documents..."
                                        rows={1}
                                        className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                        style={{ minHeight: '44px', maxHeight: '120px' }}
                                    />
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!canChat || !input.trim()}
                                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors text-sm font-medium cursor-pointer"
                                    >
                                        {loading ? '...' : 'Send'}
                                    </button>
                                </div>
                                <p className="text-gray-600 text-xs mt-2 text-center">
                                    Enter to send · Shift+Enter for new line
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
