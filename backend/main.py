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
POPULAR_DRAMAS_CACHE = None


def placeholder_poster(title: str) -> str:
    return f"https://via.placeholder.com/300x450/1a1a1a/ffffff?text={title.replace(' ', '+')}"


def clean_json_response(text_response: str) -> str:
    text_response = text_response.strip()
    match = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text_response, re.DOTALL | re.IGNORECASE)

    if match:
        return match.group(1).strip()

    return text_response


async def get_poster_url(title):
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "format": "json",
                    "generator": "search",
                    "gsrsearch": f"{title} Korean drama television series",
                    "gsrlimit": 1,
                    "prop": "pageimages",
                    "piprop": "original|thumbnail",
                    "pithumbsize": 500,
                    "redirects": 1,
                },
                headers={"User-Agent": "drama-recommender/1.0 (educational project)"},
            )

        if res.status_code == 200:
            pages = res.json().get("query", {}).get("pages", {})
            for page in pages.values():
                original = page.get("original", {}).get("source")
                thumbnail = page.get("thumbnail", {}).get("source")
                if original or thumbnail:
                    return original or thumbnail

            print(f"Wikipedia did not find a poster for {title}.")
        else:
            print(f"Wikipedia poster request failed for {title}: {res.status_code} {res.text[:200]}")

    except Exception as e:
        print(f"Error fetching Wikipedia poster for {title}: {e}")

    return placeholder_poster(title)


async def add_posters(dramas):
    enriched = []
    for index, drama in enumerate(dramas, start=1):
        title = str(drama.get("title", "")).strip()
        if not title:
            continue

        synopsis = str(drama.get("synopsis", "")).strip()
        enriched.append({
            "id": drama.get("id") or index,
            "title": title,
            "synopsis": synopsis,
            "image": await get_poster_url(title),
        })

    return enriched


@app.get("/api/popular-dramas")
async def get_popular_dramas():
    global POPULAR_DRAMAS_CACHE

    if POPULAR_DRAMAS_CACHE:
        return POPULAR_DRAMAS_CACHE

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured in the backend.")

    try:
        client = genai.Client(api_key=api_key)
        prompt = """
Recommend the top 20 Korean dramas for a general K-drama fan.
Choose widely loved and currently/highly popular dramas, mixing recent hits and modern classics.
Return the result strictly as a JSON array where each object has:
- "id": a unique integer from 1 to 20
- "title": the official English title of the Korean drama
- "synopsis": a short, spoiler-free synopsis in 1-2 sentences
- "image": a placeholder image URL, format it exactly like this: "https://via.placeholder.com/300x450/1a1a1a/ffffff?text=[Title_with_pluses]"

Return ONLY the raw JSON array. Do not wrap it in markdown code blocks like ```json.
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        popular_dramas = json.loads(clean_json_response(response.text))
        popular_dramas = await add_posters(popular_dramas[:20])
        POPULAR_DRAMAS_CACHE = popular_dramas
        return popular_dramas

    except Exception as e:
        print(f"Error generating popular dramas: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate popular Korean dramas.")


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
The user is looking for Korean drama recommendations based on this query: "{q}".
The query could be a specific drama title (e.g. 'Goblin') or a specific niche/genre (e.g. 'high school zombie survival').
Act as a highly knowledgeable drama enthusiast. Recommend 6 Korean dramas that fit the query perfectly and are highly regarded by communities like Reddit.
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

        recommendations = json.loads(clean_json_response(response.text))
        recommendations = await add_posters(recommendations)

        RECOMMENDATION_CACHE[query_key] = recommendations
        return recommendations

    except Exception as e:
        print(f"Error generating recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate AI recommendations.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
