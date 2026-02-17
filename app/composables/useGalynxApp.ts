import type { ConnectionStatus, User } from '~/types/galynx'

type GalynxAppState = {
  currentUser: User
  users: User[]
  connectionStatus: ConnectionStatus
}

const makeInitialState = (): GalynxAppState => ({
  currentUser: {
    id: '1',
    name: 'Marco Neri',
    email: 'mneridls@gmail.com',
    role: 'admin',
    status: 'active',
    avatarColor: '#22c55e'
  },
  users: [
    { id: '1', name: 'Marco Neri', email: 'mneridls@gmail.com', role: 'admin', status: 'active', avatarColor: '#22c55e' },
    { id: '2', name: 'Ana DevOps', email: 'ana@galynx.local', role: 'owner', status: 'active', avatarColor: '#06b6d4' },
    { id: '3', name: 'Luis Backend', email: 'luis@galynx.local', role: 'member', status: 'active', avatarColor: '#a855f7' },
    { id: '4', name: 'Sofía QA', email: 'sofia@galynx.local', role: 'member', status: 'active', avatarColor: '#f97316' }
  ],
  connectionStatus: 'online'
})

export const useGalynxApp = () => {
  const state = useState<GalynxAppState>('galynx-app', () => makeInitialState())

  const setConnectionStatus = (next: ConnectionStatus) => {
    state.value.connectionStatus = next
  }

  return { state, setConnectionStatus }
}