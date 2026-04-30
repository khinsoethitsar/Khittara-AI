
import { db } from "./firebase";
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

export async function learnFactAboutCreator(fact: string, source: "guest" | "creator" = "guest") {
  try {
    const memoryId = `mem_${Date.now()}`;
    const memoryRef = doc(db, COLLECTION_NAME, memoryId);
    
    await setDoc(memoryRef, {
      id: memoryId,
      fact,
      source,
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error("Error learning fact:", error);
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
    return [];
  }
}
