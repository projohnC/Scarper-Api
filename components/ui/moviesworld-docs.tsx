"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Play, Code2, Search, Video, Download } from "lucide-react";
import { toast } from "sonner";

interface ApiEndpoint {
  method: string;
  endpoint: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
}

interface ApiCategory {
  name: string;
  icon: React.ReactNode;
  endpoints: ApiEndpoint[];
}

const apiCategories: ApiCategory[] = [
  {
    name: "Search Movies/TV",
    icon: <Search className="h-4 w-4" />,
    endpoints: [
      {
        method: "GET",
        endpoint: "/api/moviesworld",
        description: "Search for movies and TV shows in Hindi with Telegram download links",
        params: [
          { name: "query", type: "string", required: false, description: "Search query (movie/TV show title)" },
          { name: "page", type: "number", required: false, description: "Page number (default: 1)" }
        ]
      }
    ]
  },
  {
    name: "Get Movie/TV Details",
    icon: <Video className="h-4 w-4" />,
    endpoints: [
      {
        method: "GET",
        endpoint: "/api/moviesworld/details",
        description: "Get detailed information including Telegram download links",
        params: [
          { name: "id", type: "string", required: true, description: "Movie/TV show ID (MongoDB ObjectId or TMDB ID)" }
        ]
      }
    ]
  }
];

interface MoviesWorldDocsProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function MoviesWorldDocs({ apiKey, onApiKeyChange }: MoviesWorldDocsProps) {
  const [selectedCategory, setSelectedCategory] = useState(apiCategories[0]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(apiCategories[0].endpoints[0]);
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleCategoryChange = (categoryName: string) => {
    const category = apiCategories.find(cat => cat.name === categoryName);
    if (category) {
      setSelectedCategory(category);
      setSelectedEndpoint(category.endpoints[0]);
      setTestParams({});
    }
  };

  const testApi = async () => {
    if (!apiKey) {
      toast.error("Please enter your API key");
      return;
    }

    const missingParams = selectedEndpoint.params?.filter(param => 
      param.required && !testParams[param.name]
    ) || [];

    if (missingParams.length > 0) {
      toast.error(`Missing required parameters: ${missingParams.map(p => p.name).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      let url = selectedEndpoint.endpoint;
      
      Object.entries(testParams).forEach(([key, value]) => {
        if (value && url.includes(`{${key}}`)) {
          url = url.replace(`{${key}}`, value);
        }
      });

      const queryParams = new URLSearchParams();
      Object.entries(testParams).forEach(([key, value]) => {
        if (value && !selectedEndpoint.endpoint.includes(`{${key}}`)) {
          queryParams.append(key, value);
        }
      });

      if (queryParams.toString()) {
        url += "?" + queryParams.toString();
      }

      const res = await fetch(url, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        }
      });

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
      
      if (!res.ok) {
        toast.error(`Error: ${res.status}`);
      } else {
        toast.success("API call successful!");
      }
    } catch (error) {
      toast.error("Failed to call API");
      setResponse(JSON.stringify({ error: "Failed to call API" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const generateCodeExample = (language: string) => {
    let url = selectedEndpoint.endpoint;
    const params = Object.entries(testParams).filter(([_, value]) => value);
    
    Object.entries(testParams).forEach(([key, value]) => {
      if (value && url.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, value || key.toUpperCase());
      }
    });

    const queryParams = params.filter(([key]) => !selectedEndpoint.endpoint.includes(`{${key}}`))
      .map(([key, value]) => `${key}=${value}`).join("&");
    if (queryParams) {
      url += "?" + queryParams;
    }

    const baseUrl = "https://totu.me";

    switch (language) {
      case "javascript":
        if (selectedCategory.name === "Search Movies/TV") {
          return `// Search for movies/TV shows
const searchQuery = "Avengers";
const response = await fetch("${baseUrl}/api/moviesworld?query=" + encodeURIComponent(searchQuery), {
  headers: {
    "x-api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
  }
});

const data = await response.json();
console.log(data.data.results); // Array of movies/TV shows`;
        } else {
          return `// Get movie/TV details with download links
const movieId = "683b6406b5f7b8941b7d5ea7"; // from search results
const response = await fetch("${baseUrl}/api/moviesworld/details?id=" + movieId, {
  headers: {
    "x-api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
  }
});

const data = await response.json();
console.log(data.data.telegram); // Download links with stream URLs`;
        }

      case "python":
        if (selectedCategory.name === "Search Movies/TV") {
          return `# Search for movies/TV shows
import requests

search_query = "Avengers"
url = "${baseUrl}/api/moviesworld"
params = {"query": search_query}
headers = {
    "x-api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
}

response = requests.get(url, params=params, headers=headers)
data = response.json()
print(data["data"]["results"])  # Array of movies/TV shows`;
        } else {
          return `# Get movie/TV details with download links
import requests

movie_id = "683b6406b5f7b8941b7d5ea7"  # from search results
url = f"${baseUrl}/api/moviesworld/details?id={movie_id}"
headers = {
    "x-api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
data = response.json()
print(data["data"]["telegram"])  # Download links with stream URLs`;
        }

      case "curl":
        if (selectedCategory.name === "Search Movies/TV") {
          return `# Search for movies/TV shows
curl -X GET \\
  "${baseUrl}/api/moviesworld?query=Avengers" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;
        } else {
          return `# Get movie/TV details with download links
curl -X GET \\
  "${baseUrl}/api/moviesworld/details?id=683b6406b5f7b8941b7d5ea7" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;
        }

      default:
        return "";
    }
  };

  return (
    <Tabs defaultValue="test" className="space-y-4 sm:space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="test" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <Play className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">API Testing</span>
          <span className="xs:hidden">Testing</span>
        </TabsTrigger>
        <TabsTrigger value="docs" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <Code2 className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Code Examples</span>
          <span className="xs:hidden">Examples</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="test" className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">API Key Setup</CardTitle>
            <CardDescription className="text-sm">
              Enter your API key to test the MoviesWorld endpoints.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className="flex-1 text-sm min-w-0"
              />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey)} className="shrink-0 self-start sm:self-auto">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">API Categories</CardTitle>
              <CardDescription className="text-sm">Select a category and endpoint to test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Category</Label>
                <Select value={selectedCategory.name} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {apiCategories.map((category) => (
                      <SelectItem key={category.name} value={category.name} className="text-sm">
                        <div className="flex items-center gap-2">
                          {category.icon}
                          <span className="truncate">{category.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default" className="text-xs">
                    {selectedEndpoint.method}
                  </Badge>
                  <code className="text-xs">{selectedEndpoint.endpoint}</code>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">{selectedEndpoint.description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Parameters</CardTitle>
              <CardDescription className="text-sm">
                Configure parameters for the endpoint
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {selectedEndpoint.params && selectedEndpoint.params.length > 0 ? (
                selectedEndpoint.params.map((param) => (
                  <div key={param.name} className="space-y-2">
                    <Label htmlFor={param.name} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="break-words">{param.name}</span>
                      <Badge variant={param.required ? "destructive" : "secondary"} className="text-xs shrink-0">
                        {param.required ? "Required" : "Optional"}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">({param.type})</span>
                    </Label>
                    <Input
                      id={param.name}
                      placeholder={param.description}
                      value={testParams[param.name] || ""}
                      onChange={(e) => setTestParams({ ...testParams, [param.name]: e.target.value })}
                      className="text-sm w-full min-w-0"
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No parameters required</p>
              )}

              <Button onClick={testApi} disabled={loading} className="w-full text-sm">
                {loading ? "Testing..." : "Test API"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Response</CardTitle>
            <CardDescription className="text-sm">API response will appear here</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-hidden">
              <Textarea
                placeholder="API response will appear here..."
                value={response}
                readOnly
                className="min-h-[200px] sm:min-h-[300px] font-mono text-xs sm:text-sm w-full resize-none"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="docs" className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">MoviesWorld API Examples</CardTitle>
            <CardDescription className="text-sm">
              Code examples for integrating with the MoviesWorld API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label className="text-sm">Category</Label>
              <Select value={selectedCategory.name} onValueChange={handleCategoryChange}>
                <SelectTrigger className="text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {apiCategories.map((category) => (
                    <SelectItem key={category.name} value={category.name} className="text-sm">
                      <div className="flex items-center gap-2">
                        {category.icon}
                        <span className="truncate">{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="javascript" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="javascript" className="text-xs sm:text-sm">JavaScript</TabsTrigger>
                <TabsTrigger value="python" className="text-xs sm:text-sm">Python</TabsTrigger>
                <TabsTrigger value="curl" className="text-xs sm:text-sm">cURL</TabsTrigger>
              </TabsList>

              {["javascript", "python", "curl"].map((lang) => (
                <TabsContent key={lang} value={lang}>
                  <div className="relative w-full overflow-hidden">
                    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800">
                      <div className="flex items-center justify-between bg-[#2d2d30] px-4 py-2 border-b border-gray-700">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex gap-1.5 shrink-0">
                            <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#27ca3f]"></div>
                          </div>
                          <span className="text-gray-300 text-sm ml-2 truncate">
                            example.{lang === "javascript" ? "js" : lang === "python" ? "py" : "sh"}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-white hover:bg-gray-700 h-6 px-2 shrink-0"
                          onClick={() => copyToClipboard(generateCodeExample(lang))}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <pre className="p-4">
                          <code className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                            {generateCodeExample(lang)}
                          </code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Response Examples</CardTitle>
            <CardDescription className="text-sm">Expected response structures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="search" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search" className="text-xs sm:text-sm">Search Results</TabsTrigger>
                <TabsTrigger value="details" className="text-xs sm:text-sm">Movie Details</TabsTrigger>
              </TabsList>

              <TabsContent value="search">
                <div className="relative w-full overflow-hidden">
                  <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800">
                    <div className="flex items-center justify-between bg-[#2d2d30] px-4 py-2 border-b border-gray-700">
                      <span className="text-gray-300 text-sm">search-response.json</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-white hover:bg-gray-700 h-6 px-2"
                        onClick={() => copyToClipboard(`{
  "success": true,
  "data": {
    "total_count": 156,
    "results": [...],
    "query": "Avengers",
    "page": 1
  }
}`)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <pre className="p-4 text-xs sm:text-sm">
                        <code className="text-gray-300 font-mono whitespace-pre-wrap break-words">{`{
  "success": true,
  "data": {
    "total_count": 156,
    "results": [
      {
        "_id": "683b6406b5f7b8941b7d5ea7",
        "tmdb_id": 1771,
        "title": "Captain America: The First Avenger",
        "genres": ["Action", "Adventure", "Science Fiction"],
        "description": "During World War II, Steve Rogers...",
        "rating": 7.002,
        "release_year": 2011,
        "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
        "backdrop": "https://image.tmdb.org/t/p/original/example.jpg",
        "media_type": "movie"
      }
    ],
    "query": "Avengers",
    "page": 1
  },
  "remainingRequests": 99
}`}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details">
                <div className="relative w-full overflow-hidden">
                  <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800">
                    <div className="flex items-center justify-between bg-[#2d2d30] px-4 py-2 border-b border-gray-700">
                      <span className="text-gray-300 text-sm">details-response.json</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-white hover:bg-gray-700 h-6 px-2"
                        onClick={() => copyToClipboard(`{
  "success": true,
  "data": {
    "title": "Captain America: The First Avenger",
    "telegram": [...]
  }
}`)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <pre className="p-4 text-xs sm:text-sm">
                        <code className="text-gray-300 font-mono whitespace-pre-wrap break-words">{`{
  "success": true,
  "data": {
    "_id": "683b6406b5f7b8941b7d5ea7",
    "title": "Captain America: The First Avenger",
    "genres": ["Action", "Adventure", "Science Fiction"],
    "rating": 7.002,
    "release_year": 2011,
    "languages": ["hi"],
    "rip": "Blu-ray",
    "telegram": [
      {
        "quality": "720p",
        "id": "lLuGQMdHL8b8VtlqoRigPmt...",
        "name": "Captain America - The First Avenger (2011) 720p...",
        "size": "1009.15MB",
        "streamUrl": "https://moviesworld738.../dl/lLuGQ.../Captain..."
      },
      {
        "quality": "1080p",
        "id": "lLuGQMdHL8b8VtlqoRigPmt...",
        "name": "Captain America - The First Avenger (2011) 1080p...",
        "size": "2.56GB",
        "streamUrl": "https://moviesworld738.../dl/lLuGQ.../Captain..."
      }
    ],
    "type": "movie"
  }
}`}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Download className="h-5 w-5" />
              MoviesWorld API Features
            </CardTitle>
            <CardDescription className="text-sm">Key features and capabilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <h4 className="font-semibold mb-2 text-sm sm:text-base">Hindi Content</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Specialized in Hindi movies and TV shows with dual audio support
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <h4 className="font-semibold mb-2 text-sm sm:text-base">Telegram Downloads</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Direct Telegram download links with multiple quality options
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <h4 className="font-semibold mb-2 text-sm sm:text-base">Stream URLs</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Ready-to-use streaming URLs for each quality option
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <h4 className="font-semibold mb-2 text-sm sm:text-base">Rich Metadata</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Complete movie information including genres, ratings, and descriptions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
