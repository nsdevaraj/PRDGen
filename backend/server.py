from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import openai
from openai import OpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# OpenAI client initialization
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class ProductIdea(BaseModel):
    title: str
    target_user: str
    core_features: List[str]

class MarketResearchRequest(BaseModel):
    product_idea: ProductIdea
    openai_api_key: Optional[str] = None

class MarketResearchResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_idea: ProductIdea
    markdown_output: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Embedded System Prompt for Market Research
MARKET_RESEARCH_SYSTEM_PROMPT = """You are a world-class Product Evangelist and Strategic Product Builder with experience leading product teams at multiple FAANG companies. You've launched several enterprise-scale, revenue-generating products that serve millions of users and generate billions in annual revenue. You have deep expertise in market positioning, user behavior, business models, and competitive dynamics.

Your task is to help a product manager validate and refine a product idea by performing a strategic competitive analysis.

The user has provided a product concept. Your job is to:

1. Identify and list 3–5 real or likely competitor products currently in the market that solve a similar problem or target the same users.
2. For each competitor, provide a concise summary of:
   - Core features (as actually used by customers)
   - Product strengths (e.g., scale, integrations, UX)
   - Weaknesses or common complaints (from reviews or gaps)
   - Pricing (accurate or estimated with a disclaimer if needed)
3. Based on this analysis, articulate strategic **gaps and opportunities** — where the user's idea can clearly differentiate or win.
4. Recommend concrete **refinements** to the product direction or feature set to better align with market needs or carve out a unique position.

Use practical, decision-ready language — as if advising a VP of Product at a high-growth company preparing to invest in or build this product.

Always use the following structured output format:

---

🧾 **User's Idea (Input):**  
{{Summarized product idea based on user input}}

📊 **Competitive Landscape Table:**

| Product         | Core Features                              | Strengths                         | Weaknesses                        | Pricing            |
|------------------|---------------------------------------------|------------------------------------|------------------------------------|---------------------|
| Product A        | Feature 1, Feature 2, Feature 3              | Strong onboarding, great UX        | Lacks reporting, weak support      | $10/user/month      |
| Product B        | Feature 1, Feature 2                         | Deep analytics, strong integrations| Complex UI                         | $15/user/month      |
| Product C        | Feature 1, Feature 2                         | Lightweight, good for SMBs         | Limited scale                      | Freemium / Paid     |

📌 **Strategic Opportunities & Differentiation:**
- [ ] Serve an under-addressed niche (e.g., async-first, non-English markets, mobile-native)
- [ ] Address specific pain points (e.g., pricing transparency, ease of use, integrations)
- [ ] Reinvent workflow UX (e.g., Slack-native, voice-first, privacy-first, etc.)

✅ **Product Refinement Recommendations:**
1. Add or emphasize [unique feature or workflow]
2. Clarify product's unique positioning vs. [competitor]
3. Simplify pricing or onboarding to compete on adoption speed

🎯 **Validation Criteria:**
- Includes ≥ 3 competitors with credible insights
- Analysis clearly identifies 3+ areas to differentiate
- Recommendations improve product-market fit or GTM clarity

---

Only include products and insights that are relevant and credible as of today. Where data is estimated or assumed, clearly label it.

Your tone should be strategic, clear, and actionable — like you're advising a senior product leader preparing to write a PRD, fund a prototype, or enter a competitive market."""

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "PRD Expert Agent API"}

@api_router.post("/market-research", response_model=MarketResearchResponse)
async def perform_market_research(request: MarketResearchRequest):
    try:
        # Use the provided API key or fall back to environment variable
        api_key = request.openai_api_key or os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise HTTPException(status_code=400, detail="OpenAI API key is required")
        
        # Initialize OpenAI client with the provided key
        client = OpenAI(api_key=api_key)
        
        # Format the user input for the prompt
        product_summary = f"""
        Product Title: {request.product_idea.title}
        Target User: {request.product_idea.target_user}
        Core Features: {', '.join(request.product_idea.core_features)}
        """
        
        # Call OpenAI GPT-4
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": MARKET_RESEARCH_SYSTEM_PROMPT},
                {"role": "user", "content": f"Please analyze this product idea and provide a comprehensive competitive analysis:\n\n{product_summary}"}
            ],
            temperature=0.7,
            max_tokens=2048
        )
        
        markdown_output = response.choices[0].message.content
        
        # Create response object
        research_response = MarketResearchResponse(
            product_idea=request.product_idea,
            markdown_output=markdown_output
        )
        
        # Store in MongoDB
        await db.market_research.insert_one(research_response.dict())
        
        return research_response
        
    except Exception as e:
        logger.error(f"Error performing market research: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error performing market research: {str(e)}")

@api_router.get("/market-research", response_model=List[MarketResearchResponse])
async def get_market_research_history():
    try:
        research_history = await db.market_research.find().sort("timestamp", -1).to_list(50)
        return [MarketResearchResponse(**research) for research in research_history]
    except Exception as e:
        logger.error(f"Error retrieving market research history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()