const scopePath = '/v13-test/'

export function assertIsolatedV13Controller() {
  const scope = new URL(scopePath, location.origin)
  if (!location.pathname.startsWith(scope.pathname) || !window.isSecureContext ||
      navigator.serviceWorker?.controller?.scriptURL !== new URL('v13-worker.js', scope).href) {
    throw new Error('V13_ISOLATION_REQUIRED')
  }
}

export async function verifyIsolatedV13() {
  const scope = new URL(scopePath, location.origin).href
  const worker = new URL('v13-worker.js', scope).href
  const reloadKey = 'training-check-v13-controller-reload'
  const container = navigator.serviceWorker
  if (!location.href.startsWith(scope) || !window.isSecureContext || !container) {
    throw new Error('V1.3 検証環境の接続先を確認できません')
  }
  const registration = await container.register(worker, { scope })
  if (registration.scope !== scope) throw new Error('V1.3 Service Worker scope mismatch')
  if (container.controller?.scriptURL === worker && registration.active?.scriptURL === worker) {
    sessionStorage.removeItem(reloadKey)
    return
  }

  // A previously installed root worker can own the first child navigation.
  // A fresh navigation is required to select the now-active child scope.
  await new Promise<void>((resolve, reject) => {
    const candidate = registration.installing ?? registration.waiting ?? registration.active
    if (!candidate || candidate.scriptURL !== worker) { reject(new Error('V1.3 Service Worker mismatch')); return }
    const timeout = window.setTimeout(() => finish(new Error('V1.3 Service Worker activation timeout')), 10000)
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      candidate.removeEventListener('statechange', check)
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      if (candidate.state === 'activated') finish()
      if (candidate.state === 'redundant') finish(new Error('V1.3 Service Worker activation failed'))
    }
    candidate.addEventListener('statechange', check)
    check()
  })
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1')
    location.reload()
  }
  throw new Error('V1.3 の Service Worker に制御されていません')
}
