import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface ManagedUser {
    id: string;
    email: string;
    role: 'admin' | 'user';
}

export const UserManagement: React.FC = () => {
    const { session, user: currentUser } = useAuth();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
    
    const sessionRef = useRef(session);
    sessionRef.current = session;

    const fetchUsers = useCallback(async () => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch users.');
            }
            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
        const accessToken = sessionRef.current?.access_token;
        if (!accessToken) return;
        setUpdatingId(userId);
        setError(null);
        try {
            const response = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ role: newRole }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to update user role.');
            }
            await fetchUsers(); // Refresh list on success
        } catch (err: any) {
            setError(`Failed to update role: ${err.message}`);
        } finally {
            setUpdatingId(null);
        }
    }
    
    const handleConfirmDelete = async () => {
        const accessToken = sessionRef.current?.access_token;
        if (!userToDelete || !accessToken) return;
        setUpdatingId(userToDelete.id);
        setError(null);
        try {
            const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
             if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to delete user.');
            }
            await fetchUsers(); // Refresh list
        } catch (err: any) {
            setError(`Failed to delete user: ${err.message}`);
        } finally {
            setUpdatingId(null);
            setUserToDelete(null);
        }
    }


    return (
        <>
            <div className="p-6 mt-8 bg-white rounded-lg shadow-md">
                <h3 className="text-lg font-medium leading-6 text-slate-900">User Management</h3>
                <p className="mt-1 text-sm text-slate-500">Promote users to administrators or revoke admin privileges.</p>
                <div className="mt-4">
                    {isLoading && (
                        <div className="flex justify-center items-center py-8">
                           <SpinnerIcon className="w-8 h-8 text-sky-600" />
                       </div>
                    )}
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {!isLoading && !error && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-800'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {/* Prevent admins from modifying their own account */}
                                                {user.id !== currentUser?.id ? (
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')}
                                                            disabled={updatingId === user.id}
                                                            className={`inline-flex items-center justify-center w-32 px-3 py-1.5 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50
                                                                ${user.role === 'admin' ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500' : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500'}`}
                                                        >
                                                            {updatingId === user.id ? <SpinnerIcon className="w-4 h-4" /> : (user.role === 'admin' ? 'Remove Admin' : 'Make Admin')}
                                                        </button>
                                                        <button
                                                            onClick={() => setUserToDelete(user)}
                                                            disabled={updatingId === user.id}
                                                            className="text-slate-400 hover:text-red-600 disabled:opacity-50 p-1.5 rounded-md hover:bg-red-50"
                                                            title={`Delete user ${user.email}`}
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            {userToDelete && (
                <ConfirmDeleteModal
                    isOpen={!!userToDelete}
                    onClose={() => setUserToDelete(null)}
                    onConfirm={handleConfirmDelete}
                    isDeleting={updatingId === userToDelete.id}
                    userName={userToDelete.email}
                />
            )}
        </>
    );
}