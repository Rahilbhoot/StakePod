import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/react-router'
import { AuthProvider } from './AuthContext'

// Import Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import CreatePod from './pages/CreatePod'
import InvitePreview from './pages/InvitePreview'
import PledgeSuccess from './pages/PledgeSuccess'
import PledgeCancelled from './pages/PledgeCancelled'
import PodDetail from './pages/PodDetail'

// 1. Root Route
const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
})

// 2. Define Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: Signup,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: Dashboard,
})

const createPodRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/create-pod',
  component: CreatePod,
})

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$code',
  component: () => {
    const { code } = inviteRoute.useParams()
    return <InvitePreview code={code} />
  },
})

const pledgeSuccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pledge-success',
  component: PledgeSuccess,
})

const pledgeCancelledRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/cancelled',
  component: PledgeCancelled,
})

const podDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pods/$podId',
  component: () => {
    const { podId } = podDetailRoute.useParams()
    return <PodDetail podId={podId} />
  },
})

// 3. Router Tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  dashboardRoute,
  createPodRoute,
  inviteRoute,
  pledgeSuccessRoute,
  pledgeCancelledRoute,
  podDetailRoute,
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <RouterProvider router={router} />
}
