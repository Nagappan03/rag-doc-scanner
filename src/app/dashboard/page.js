'use client'

import { useState, useEffect, useRef } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function DeleteModal({ document, onConfirm, onCancel, deleting }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />
            {/* Modal */}
            <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <div className="text-3xl mb-3">🗑️</div>
                <h3 className="text-white font-semibold text-lg mb-1">Delete Document</h3>
                <p className="text-gray-400 text-sm mb-1">
                    Are you sure you want to delete:
                </p>
                <p className="text-white text-sm font-medium bg-gray-800 px-3 py-2 rounded-lg mb-4 truncate">
                    {document?.name}
                </p>
                <p className="text-gray-500 text-xs mb-6">
                    This will permanently remove the document and all its chunks. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={deleting}
                        className="flex-1 py-2.5 px-4 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                        {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
    })
}

export default function DashboardPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const fileInputRef = useRef(null)

    const [documents, setDocuments] = useState([])
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [uploadSuccess, setUploadSuccess] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        try {
            const res = await fetch('/api/documents')
            const data = await res.json()
            setDocuments(data.documents || [])
        } catch (err) {
            console.error('Failed to fetch documents', err)
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setUploadError('')
        setUploadSuccess('')

        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/documents', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()

            if (!res.ok) {
                setUploadError(data.error || 'Upload failed')
                return
            }

            setUploadSuccess(`"${data.document.name}" uploaded successfully — ${data.document.chunkCount} chunks processed.`)
            fetchDocuments()
        } catch (err) {
            setUploadError('Something went wrong. Please try again.')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/documents?id=${deleteTarget.id}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
            }
        } catch (err) {
            console.error('Delete failed', err)
        } finally {
            setDeleting(false)
            setDeleteTarget(null)
        }
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Delete modal */}
            {deleteTarget && (
                <DeleteModal
                    document={deleteTarget}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => !deleting && setDeleteTarget(null)}
                    deleting={deleting}
                />
            )}

            {/* Navbar */}
            <nav className="border-b border-gray-800 bg-gray-900 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">R</div>
                    <span className="text-white font-semibold truncate">RAG Doc Q&A</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    <button
                        onClick={() => router.push('/chat')}
                        className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                        Chat →
                    </button>
                    <span className="text-gray-400 text-sm hidden sm:inline truncate max-w-[120px]">{session?.user?.name}</span>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                        Sign out
                    </button>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Documents</h1>
                    <p className="text-gray-400 mt-1 text-sm">Upload PDFs or text files to chat with them</p>
                </div>

                {/* Upload area */}
                <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center mb-6 transition-colors cursor-pointer ${uploading
                        ? 'border-blue-500 bg-blue-500/5 cursor-not-allowed'
                        : 'border-gray-700 hover:border-blue-500 hover:bg-blue-500/5'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.md,.txt"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                    />
                    <div className="text-4xl mb-3">{uploading ? '⏳' : '📄'}</div>
                    <p className="text-white font-medium text-sm sm:text-base">
                        {uploading ? 'Processing document...' : 'Click to upload a document'}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">PDF, Markdown, or plain text — max 10MB</p>
                </div>

                {/* Feedback messages */}
                {uploadError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {uploadError}
                    </div>
                )}
                {uploadSuccess && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                        {uploadSuccess}
                    </div>
                )}

                {/* Documents list */}
                <div className="bg-gray-900 rounded-xl border border-gray-800">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-800">
                        <h2 className="text-white font-medium">
                            Your Documents
                            <span className="ml-2 text-gray-500 text-sm font-normal">({documents.length})</span>
                        </h2>
                    </div>

                    {loading ? (
                        <div className="px-6 py-12 text-center text-gray-500">Loading...</div>
                    ) : documents.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <p className="text-gray-500">No documents uploaded yet</p>
                            <p className="text-gray-600 text-sm mt-1">Upload a document above to get started</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-800">
                            {documents.map((doc) => (
                                <li key={doc.id} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="text-2xl flex-shrink-0">
                                            {doc.type === 'application/pdf' ? '📕' : '📝'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white font-medium text-sm truncate">{doc.name}</p>
                                            <p className="text-gray-500 text-xs mt-0.5">
                                                {formatFileSize(doc.size)} · {doc._count.chunks} chunks · {formatDate(doc.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setDeleteTarget(doc)}
                                        className="text-gray-600 hover:text-red-400 text-sm transition-colors cursor-pointer flex-shrink-0"
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
