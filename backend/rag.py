import os
import faiss
import numpy as np
import tempfile
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Load local embedding model (downloads automatically if not present, then cached)
# all-MiniLM-L6-v2 is extremely fast and high quality for general/medical English.
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# We will store indices in memory for the active session, 
# keyed by file_id.
# Format: { "file_id": {"index": faiss_index, "chunks": ["text1", "text2"]} }
rag_store = {}

def build_faiss_index(file_id: str, text: str):
    """
    Chunks the document text, embeds it, and stores in FAISS index.
    """
    print(f"Building FAISS index for {file_id}...")
    
    # 1. Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_text(text)
    
    if not chunks:
        print("No text chunks generated.")
        return
        
    # 2. Embedding
    embeddings = embedder.encode(chunks, show_progress_bar=False)
    
    # 3. FAISS Index
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings).astype("float32"))
    
    rag_store[file_id] = {
        "index": index,
        "chunks": chunks
    }
    print(f"FAISS index built for {file_id} with {len(chunks)} chunks.")

def search_faiss_index(file_id: str, query: str, top_k: int = 5) -> str:
    """
    Embeds the user query and searches the FAISS index for relevant chunks.
    Returns the concatenated chunks.
    """
    if file_id not in rag_store:
        return ""
        
    store = rag_store[file_id]
    index = store["index"]
    chunks = store["chunks"]
    
    query_emb = embedder.encode([query])
    D, I = index.search(np.array(query_emb).astype("float32"), top_k)
    
    results = []
    for idx in I[0]:
        if idx < len(chunks):
            results.append(chunks[idx])
            
    return "\n\n---\n\n".join(results)
