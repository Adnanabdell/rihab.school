// Fix: Replaced placeholder content with a functional React component for the main application.
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Spinner from './components/Spinner';
import SearchIcon from './components/icons/SearchIcon';
import ClearIcon from './components/icons/ClearIcon';
import RefreshIcon from './components/icons/RefreshIcon';
import { GroundingChunk } from './types';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; sources: GroundingChunk[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Per instructions, initialize AI instance with API key from environment variables.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
          tools: [{googleSearch: {}}],
        },
      });

      const text = response.text;
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] || [];
      
      setResult({ text, sources });

    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResult(null);
    setError(null);
  };
  
  const handleRefresh = () => {
    if (!loading) {
        handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-blue-600 mb-6">AI Search with Grounding</h1>
        
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
            placeholder="Ask anything..."
            className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {query && (
              <button onClick={handleClear} className="p-1 text-gray-500 hover:text-gray-700">
                <ClearIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="ml-2 bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 disabled:bg-blue-300 transition"
            >
              <SearchIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading && <Spinner />}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {result && (
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">Result</h2>
                <button onClick={handleRefresh} disabled={loading} className="text-gray-500 hover:text-gray-700 p-1 disabled:text-gray-300">
                    <RefreshIcon className="w-6 h-6"/>
                </button>
            </div>
            <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">{result.text}</div>
            
            {result.sources.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Sources:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {result.sources.map((source, index) => (
                    source.web ? (
                      <li key={index}>
                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {source.web.title || source.web.uri}
                        </a>
                      </li>
                    ) : null
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
