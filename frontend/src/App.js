import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const App = () => {
  const [productIdea, setProductIdea] = useState({
    title: "",
    target_user: "",
    core_features: [""]
  });
  const [openaiKey, setOpenaiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [marketResearch, setMarketResearch] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [researchHistory, setResearchHistory] = useState([]);
  const markdownRef = useRef(null);

  useEffect(() => {
    fetchResearchHistory();
  }, []);

  const fetchResearchHistory = async () => {
    try {
      const response = await axios.get(`${API}/market-research`);
      setResearchHistory(response.data.slice(0, 5)); // Show last 5 researches
    } catch (e) {
      console.error("Error fetching research history:", e);
    }
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...productIdea.core_features];
    newFeatures[index] = value;
    setProductIdea({ ...productIdea, core_features: newFeatures });
  };

  const addFeature = () => {
    setProductIdea({ 
      ...productIdea, 
      core_features: [...productIdea.core_features, ""] 
    });
  };

  const removeFeature = (index) => {
    const newFeatures = productIdea.core_features.filter((_, i) => i !== index);
    setProductIdea({ ...productIdea, core_features: newFeatures });
  };

  const performMarketResearch = async () => {
    if (!productIdea.title || !productIdea.target_user || !openaiKey) {
      setError("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const filteredFeatures = productIdea.core_features.filter(f => f.trim() !== "");
      
      const response = await axios.post(`${API}/market-research`, {
        product_idea: {
          ...productIdea,
          core_features: filteredFeatures
        },
        openai_api_key: openaiKey
      });

      setMarketResearch(response.data);
      fetchResearchHistory();
    } catch (e) {
      console.error("Error performing market research:", e);
      setError(e.response?.data?.detail || "An error occurred while performing market research");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromHistory = (research) => {
    setProductIdea(research.product_idea);
    setMarketResearch(research);
  };

  const resetForm = () => {
    setProductIdea({
      title: "",
      target_user: "",
      core_features: [""]
    });
    setOpenaiKey("");
    setGithubToken("");
    setGithubRepo("");
    setMarketResearch(null);
    setError("");
    setSuccess("");
  };

  const exportToPDF = async () => {
    if (!marketResearch) return;
    
    setIsExporting(true);
    try {
      const element = markdownRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`PRD_${productIdea.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      setSuccess("PDF exported successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError("Error exporting PDF: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const postToGitHub = async () => {
    if (!marketResearch || !githubToken || !githubRepo) {
      setError("Please provide GitHub token and repository (format: owner/repo)");
      return;
    }
    
    setIsPosting(true);
    try {
      const [owner, repo] = githubRepo.split('/');
      if (!owner || !repo) {
        throw new Error("Repository format should be 'owner/repository'");
      }
      
      const issueData = {
        title: `PRD: ${productIdea.title}`,
        body: `# Product Requirements Document
        
${marketResearch.markdown_output}

---
*Generated by PRD Expert Agent on ${new Date().toLocaleDateString()}*`,
        labels: ["PRD", "product-requirements", "market-research"]
      };
      
      const response = await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        issueData,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          }
        }
      );
      
      setSuccess(`Successfully posted to GitHub! Issue #${response.data.number}`);
      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      console.error("GitHub API Error:", error);
      setError(`Error posting to GitHub: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PRD Expert Agent</h1>
                <p className="text-sm text-gray-600">AI-Powered Competitive Market Research</p>
              </div>
            </div>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              New Analysis
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Input Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Product Details</h2>
              
              {/* Product Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Title *
                </label>
                <input
                  type="text"
                  value={productIdea.title}
                  onChange={(e) => setProductIdea({ ...productIdea, title: e.target.value })}
                  placeholder="e.g., Async feedback platform for remote teams"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Target User */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target User *
                </label>
                <input
                  type="text"
                  value={productIdea.target_user}
                  onChange={(e) => setProductIdea({ ...productIdea, target_user: e.target.value })}
                  placeholder="e.g., PeopleOps teams in startups"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Core Features */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Core Features
                </label>
                {productIdea.core_features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleFeatureChange(index, e.target.value)}
                      placeholder={`Feature ${index + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    {productIdea.core_features.length > 1 && (
                      <button
                        onClick={() => removeFeature(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addFeature}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  <span>Add Feature</span>
                </button>
              </div>

              {/* OpenAI API Key */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OpenAI API Key *
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your key from{" "}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    OpenAI Platform
                  </a>
                </p>
              </div>

              {/* GitHub Integration */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">GitHub Integration (Optional)</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GitHub Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Create token at{" "}
                    <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      GitHub Settings
                    </a>
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repository (owner/repo)
                  </label>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="myorg/my-repo"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Repository where to create PRD issue
                  </p>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={performMarketResearch}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Analyzing Market...</span>
                  </div>
                ) : (
                  "Generate Market Research"
                )}
              </button>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {success && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              {/* Research History */}
              {researchHistory.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Research</h3>
                  <div className="space-y-2">
                    {researchHistory.map((research, index) => (
                      <button
                        key={research.id}
                        onClick={() => loadFromHistory(research)}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <p className="font-medium text-gray-900 text-sm truncate">{research.product_idea.title}</p>
                        <p className="text-xs text-gray-500">{new Date(research.timestamp).toLocaleDateString()}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {marketResearch ? (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Market Research Results</h2>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    Generated {new Date(marketResearch.timestamp).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="prose prose-lg max-w-none">
                  <ReactMarkdown
                    components={{
                      table: ({children}) => (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 my-6">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({children}) => (
                        <thead className="bg-gray-50">{children}</thead>
                      ),
                      th: ({children}) => (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {children}
                        </th>
                      ),
                      td: ({children}) => (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {children}
                        </td>
                      ),
                      h1: ({children}) => (
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">{children}</h1>
                      ),
                      h2: ({children}) => (
                        <h2 className="text-2xl font-semibold text-gray-800 mb-3 mt-6">{children}</h2>
                      ),
                      h3: ({children}) => (
                        <h3 className="text-xl font-semibold text-gray-700 mb-2 mt-4">{children}</h3>
                      ),
                      ul: ({children}) => (
                        <ul className="space-y-2 my-4">{children}</ul>
                      ),
                      li: ({children}) => (
                        <li className="flex items-start space-x-2">
                          <span className="text-blue-500 mt-1.5">•</span>
                          <span>{children}</span>
                        </li>
                      ),
                      p: ({children}) => (
                        <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
                      )
                    }}
                  >
                    {marketResearch.markdown_output}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="bg-gradient-to-r from-blue-100 to-indigo-100 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <svg className="w-12 h-12 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Analyze</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Fill in your product details and get AI-powered competitive market research with strategic insights and recommendations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Competitor Analysis</h4>
                    <p className="text-sm text-blue-700">Identify 3-5 real competitors with detailed feature comparison</p>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-indigo-900 mb-2">Strategic Gaps</h4>
                    <p className="text-sm text-indigo-700">Discover differentiation opportunities in the market</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-900 mb-2">Recommendations</h4>
                    <p className="text-sm text-purple-700">Get actionable insights to refine your product strategy</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;