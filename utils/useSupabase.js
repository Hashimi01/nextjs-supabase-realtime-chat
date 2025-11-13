import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const useSupabase = () => {
    const [currentUser, setCurrentUser] = useState(null)
    const [session, setSession] = useState(null)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        if (!session?.user?.id) {
            setCurrentUser(null)
            return
        }

        let channel = null

        const getCurrentUser = async () => {
            const userId = session.user.id
            const userEmail = session.user.email

            // First, try to get existing user
            let { data: currentUserData, error } = await supabase
                .from('user')
                .select('*')
                .eq('id', userId)
                .single()

            // If user doesn't exist, create it
            if (error && error.code === 'PGRST116') {
                const insertPayload = {
                    id: userId,
                    username: null,
                    email: userEmail
                }
                const { data: newUser, error: insertError } = await supabase
                    .from('user')
                    .insert([insertPayload])
                    .select()
                    .single()

                if (insertError) {
                    console.error('Error creating user profile:', insertError)
                    setCurrentUser(null)
                    return
                }
                currentUserData = newUser
            } else if (error || !currentUserData) {
                console.error('Error fetching user:', error)
                setCurrentUser(null)
                return
            }

            // Ensure email column stays in sync with auth email
            if (userEmail && currentUserData.email !== userEmail) {
                const { data: updated } = await supabase
                    .from('user')
                    .update({ email: userEmail })
                    .eq('id', userId)
                    .select()
                    .single()
                if (updated) {
                    currentUserData = updated
                }
            }

            setCurrentUser(currentUserData)

            // Subscribe to user updates
            channel = supabase
                .channel(`user:${currentUserData.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'user',
                        filter: `id=eq.${currentUserData.id}`
                    },
                    (payload) => {
                        setCurrentUser(payload.new)
                    }
                )
                .subscribe()
        }

        getCurrentUser()

        return () => {
            if (channel) {
                supabase.removeChannel(channel)
            }
        }
    }, [session])
    return { currentUser,session, supabase }
}

export default useSupabase