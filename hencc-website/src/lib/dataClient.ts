class HttpError extends Error {
  readonly status: number

  constructor(url: string, status: number) {
    super(`HTTP ${status} while loading ${url}`)
    this.name = 'HttpError'
    this.status = status
  }
}

const jsonPromiseCache = new Map<string, Promise<unknown>>()

const sharedJsonPromise = <T>(url: string) => {
  const cached = jsonPromiseCache.get(url)
  if (cached) return cached as Promise<T>

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new HttpError(url, response.status)
      return response.json() as Promise<T>
    })
    .catch((error: unknown) => {
      jsonPromiseCache.delete(url)
      throw error
    })

  jsonPromiseCache.set(url, request)
  return request
}

const abortError = () => new DOMException('The operation was aborted.', 'AbortError')

const withConsumerSignal = <T>(promise: Promise<T>, signal?: AbortSignal) => {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject<T>(abortError())

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

export const fetchJsonCached = <T>(url: string, signal?: AbortSignal) => withConsumerSignal(sharedJsonPromise<T>(url), signal)

export const fetchOptionalJsonCached = async <T>(url: string, fallback: T, signal?: AbortSignal) => {
  try {
    return await fetchJsonCached<T>(url, signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof HttpError && error.status === 404) return fallback
    console.warn(`Optional JSON data could not be loaded: ${url}`, error)
    return fallback
  }
}
