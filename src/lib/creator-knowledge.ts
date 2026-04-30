
import { db, auth } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";

export interface CreatorMemory {
  id: string;
  fact: string;
  source: string; // "guest" | "creator"
  timestamp: any;
}

const COLLECTION_NAME = "creator_memories";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error(`Firestore Error [${operationType}] on [${path}]:`, JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function learnFactAboutCreator(fact: string, source: "guest" | "creator" = "guest") {
  const memoryId = `mem_${Date.now()}`;
  const memoryRef = doc(db, COLLECTION_NAME, memoryId);
  
  try {
    await setDoc(memoryRef, {
      id: memoryId,
      fact,
      source,
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${memoryId}`);
    } catch (e) {
      // Just log and return false for the UI
    }
    return false;
  }
}

export async function getCreatorMemories(): Promise<CreatorMemory[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    
    // Sort in memory to avoid indexing requirements for now
    const memories = snapshot.docs.map(doc => ({
      ...doc.data()
    })) as CreatorMemory[];

    return memories.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.error("Error getting creator memories:", error);
    try {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    } catch (e) {
      // Return empty array
    }
    return [];
  }
}
