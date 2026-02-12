import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export const FRIENDLY_ENV_ERROR = 'Firebase env vars missing. Create .env.local with VITE_FB_* values.'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

const missingEnvKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

let app = null
let db = null
let storage = null
let firebaseError = ''

if (missingEnvKeys.length > 0) {
  firebaseError = FRIENDLY_ENV_ERROR
} else {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    storage = getStorage(app)
  } catch (error) {
    firebaseError = `Firebase initialization failed: ${error?.message || 'Unknown error'}`
  }
}

const firebaseReady = Boolean(app && db && storage && !firebaseError)

export {
  app,
  db,
  storage,
  firebaseError,
  firebaseReady,
  missingEnvKeys,
}
