import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyD1vPAUcVxmltPs1HDalhapPENG-BtzOlI",
  authDomain: "shadcn-e8c04.firebaseapp.com",
  projectId: "shadcn-e8c04",
  storageBucket: "shadcn-e8c04.firebasestorage.app",
  messagingSenderId: "329209486298",
  appId: "1:329209486298:web:278b79d2b64226cc577ee3",
  measurementId: "G-DWM04D2FRQ"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider()

export default app
