import os
import json
import re
import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = FastAPI()

# Allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Should usually only allow frontend domain to call backend
    allow_credentials=True,     # Allow browser to include user specific details (cookies) in cross-origin requests
    allow_methods=["*"],    # Allow HTTP methods (get, post, put, delete)
    allow_headers=["*"],
)

RECOMMENDATION_CACHE = {}

async def get_poster_url(title):
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(
                "https://api.tvmaze.com/search/shows",
                params={"q": title}
            )

        if res.status_code == 200:
            data = res.json()

            if data and len(data) > 0:
                img = data[0].get("show", {}).get("image", {})

                if img and img.get("original"):
                    return img["original"]

    except Exception as e:
        print(f"Error fetching poster for {title}: {e}")

    return f"https://via.placeholder.com/300x450/1a1a1a/ffffff?text={title.replace(' ', '+')}"

@app.get("/api/recommendations")
async def get_recommendations(q: str = Query(None, description="Enter drama")):
    if not q:
        return []
        
    query_key = q.lower().strip()
    if query_key in RECOMMENDATION_CACHE:
        return RECOMMENDATION_CACHE[query_key]
        
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured in the backend.")

    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
The user is looking for drama recommendations based on this query: "{q}".
The query could be a specific drama title (e.g. 'Goblin') or a specific niche/genre (e.g. 'high school zombie survival').
Act as a highly knowledgeable drama enthusiast. Recommend 5 dramas that fit the query perfectly and are highly regarded by communities like Reddit.
Return the result strictly as a JSON array where each object has:
- "id": a unique integer
- "title": the title of the recommended drama
- "synopsis": a short, engaging description of what it's about and why it fits the query
- "image": a placeholder image URL, format it exactly like this: "https://via.placeholder.com/300x450/1a1a1a/ffffff?text=[Title_with_pluses]"

Return ONLY the raw JSON array. Do not wrap it in markdown code blocks like ```json.
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        
        text_response = response.text.strip()

        def clean_json_response(text_response: str) -> str:
            text_response = text_response.strip()

            match = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text_response, re.DOTALL | re.IGNORECASE)

            if match:
                return match.group(1).strip()

            return text_response
        
        text_response = clean_json_response(text_response)
            
        recommendations = json.loads(text_response)
        
        for drama in recommendations:
            drama["image"] = await get_poster_url(drama.get("title", ""))
            
        RECOMMENDATION_CACHE[query_key] = recommendations
        return recommendations
        
    except Exception as e:
        print(f"Error generating recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate AI recommendations.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
