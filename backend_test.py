#!/usr/bin/env python3
"""
Backend Testing Suite for PRD Expert Agent
Tests OpenAI integration, API endpoints, database storage, and error handling
"""

import requests
import json
import time
import os
from datetime import datetime

# Get backend URL from frontend .env file
BACKEND_URL = "https://0c183244-174c-4533-8f6a-ffedaa2d85d3.preview.emergentagent.com/api"

# Test data from review request
SAMPLE_PRODUCT_IDEA = {
    "product_idea": {
        "title": "Async feedback platform for remote teams",
        "target_user": "PeopleOps teams in startups", 
        "core_features": ["anonymous feedback", "pulse surveys", "Slack integration"]
    }
}

def test_api_health():
    """Test basic API connectivity"""
    print("🔍 Testing API Health...")
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        if response.status_code == 200:
            print("✅ API is accessible")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ API health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API health check failed: {str(e)}")
        return False

def test_market_research_endpoint_with_valid_key():
    """Test market research endpoint with valid OpenAI API key"""
    print("\n🔍 Testing Market Research Endpoint with Valid API Key...")
    
    # Read OpenAI API key from backend .env
    try:
        with open('/app/backend/.env', 'r') as f:
            env_content = f.read()
            for line in env_content.split('\n'):
                if line.startswith('OPENAI_API_KEY='):
                    api_key = line.split('=', 1)[1].strip('"')
                    break
        
        test_data = SAMPLE_PRODUCT_IDEA.copy()
        test_data["openai_api_key"] = api_key
        
        response = requests.post(
            f"{BACKEND_URL}/market-research",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=60  # OpenAI calls can take time
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Market research endpoint working")
            print(f"   Response ID: {result.get('id')}")
            print(f"   Markdown length: {len(result.get('markdown_output', ''))}")
            print(f"   Timestamp: {result.get('timestamp')}")
            
            # Check if response contains expected structure
            markdown = result.get('markdown_output', '')
            if '**Competitive Landscape Table:**' in markdown and '**Strategic Opportunities**' in markdown:
                print("✅ Response contains expected structured format")
                return True, result.get('id')
            else:
                print("⚠️  Response missing expected structure")
                print(f"   First 200 chars: {markdown[:200]}...")
                return True, result.get('id')
        else:
            print(f"❌ Market research failed with status {response.status_code}")
            print(f"   Error: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Market research test failed: {str(e)}")
        return False, None

def test_market_research_without_api_key():
    """Test market research endpoint without API key (should use env variable)"""
    print("\n🔍 Testing Market Research Endpoint without API Key...")
    
    try:
        test_data = SAMPLE_PRODUCT_IDEA.copy()
        # Don't include openai_api_key - should fall back to env variable
        
        response = requests.post(
            f"{BACKEND_URL}/market-research",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            print("✅ Properly falls back to environment API key")
            result = response.json()
            print(f"   Response ID: {result.get('id')}")
            print(f"   Markdown length: {len(result.get('markdown_output', ''))}")
            return True
        else:
            print(f"❌ Expected 200 success but got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ API key fallback test failed: {str(e)}")
        return False

def test_market_research_with_invalid_api_key():
    """Test market research endpoint with invalid API key"""
    print("\n🔍 Testing Market Research Endpoint with Invalid API Key...")
    
    try:
        test_data = SAMPLE_PRODUCT_IDEA.copy()
        test_data["openai_api_key"] = "sk-invalid-key-12345"
        
        response = requests.post(
            f"{BACKEND_URL}/market-research",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 500:
            print("✅ Properly handles invalid API key with error")
            print(f"   Error message: {response.json().get('detail')}")
            return True
        else:
            print(f"❌ Expected error but got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Invalid API key test failed: {str(e)}")
        return False

def test_research_history_retrieval():
    """Test GET endpoint for research history"""
    print("\n🔍 Testing Research History Retrieval...")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/market-research",
            timeout=10
        )
        
        if response.status_code == 200:
            history = response.json()
            print(f"✅ History retrieval working - found {len(history)} records")
            
            if len(history) > 0:
                latest = history[0]
                print(f"   Latest record ID: {latest.get('id')}")
                print(f"   Latest timestamp: {latest.get('timestamp')}")
                print(f"   Product title: {latest.get('product_idea', {}).get('title')}")
                return True
            else:
                print("   No history records found (expected if no previous tests)")
                return True
        else:
            print(f"❌ History retrieval failed with status {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ History retrieval test failed: {str(e)}")
        return False

def test_input_validation():
    """Test API input validation"""
    print("\n🔍 Testing Input Validation...")
    
    # Test missing required fields
    try:
        invalid_data = {"product_idea": {"title": "Test"}}  # Missing target_user and core_features
        
        response = requests.post(
            f"{BACKEND_URL}/market-research",
            json=invalid_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 422:
            print("✅ Properly validates required fields")
            return True
        else:
            print(f"❌ Expected 422 validation error but got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Input validation test failed: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("=" * 60)
    print("🚀 Starting PRD Expert Agent Backend Tests")
    print("=" * 60)
    
    test_results = {}
    
    # Test 1: API Health
    test_results['api_health'] = test_api_health()
    
    # Test 2: Market Research with Valid Key
    test_results['market_research_valid'], research_id = test_market_research_endpoint_with_valid_key()
    
    # Test 3: Market Research without API Key
    test_results['market_research_no_key'] = test_market_research_without_api_key()
    
    # Test 4: Market Research with Invalid API Key
    test_results['market_research_invalid_key'] = test_market_research_with_invalid_api_key()
    
    # Test 5: Research History Retrieval
    test_results['history_retrieval'] = test_research_history_retrieval()
    
    # Test 6: Input Validation
    test_results['input_validation'] = test_input_validation()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(test_results.values())
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print("⚠️  Some backend tests FAILED!")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)