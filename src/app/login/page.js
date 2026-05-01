'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({ email: '', password: '' })
    const [errors, setErrors] = useState({})
    const [serverError, setServerError] = useState('')
    const [loading, setLoading] = useState(false)

    const validate = () => {
        const newErrors = {}

        if (!formData.email) {
            newErrors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Enter a valid email address'
        }

        if (!formData.password) {
            newErrors.password = 'Password is required'
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters'
        }

        return newErrors
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData({ ...formData, [name]: value })
        if (errors[name]) {
            setErrors({ ...errors, [name]: '' })
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setServerError('')

        const validationErrors = validate()
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors)
            return
        }

        setLoading(true)

        const result = await signIn('credentials', {
            email: formData.email,
            password: formData.password,
            redirect: false,
        })

        if (result?.error) {
            setServerError('Invalid email or password. Please try again.')
            setLoading(false)
            return
        }

        router.push('/dashboard')
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Welcome back</h1>
                    <p className="text-gray-400 mt-2">Sign in to your account</p>
                </div>

                <div className="bg-gray-900 rounded-2xl p-5 sm:p-8 border border-gray-800">
                    {serverError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {serverError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                Email
                            </label>
                            <input
                                type="text"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors ${errors.email ? 'border-red-500' : 'border-gray-700'
                                    }`}
                                placeholder="you@example.com"
                            />
                            {errors.email && (
                                <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors ${errors.password ? 'border-red-500' : 'border-gray-700'
                                    }`}
                                placeholder="••••••••"
                            />
                            {errors.password && (
                                <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors cursor-pointer"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <p className="text-center text-gray-400 text-sm mt-6">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
