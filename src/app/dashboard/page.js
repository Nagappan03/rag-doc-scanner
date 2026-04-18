'use client'

import { signOut, useSession } from 'next-auth/react'

export default function DashboardPage() {
    const { data: session } = useSession()

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-2">
                    Welcome, {session?.user?.name || session?.user?.email}
                </h1>
                <p className="text-gray-400 mb-8">You are successfully logged in</p>
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                    Sign out
                </button>
            </div>
        </div>
    )
}