export default defineNuxtRouteMiddleware(async (to) => {
  const app = useGalynxApp()

  if (to.path === '/login') {
    if (app.state.value.currentUser) return navigateTo('/')
    try {
      await app.bootstrap()
      if (app.state.value.currentUser) return navigateTo('/')
    } catch {
      // Keep user on login when session is missing/invalid.
    }
    return
  }

  if (app.state.value.currentUser) return

  try {
    await app.bootstrap()
  } catch {
    return navigateTo('/login')
  }
})
