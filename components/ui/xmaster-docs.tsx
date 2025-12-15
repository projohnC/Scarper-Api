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
import { Copy, Play, Code2, Search, Video, Download, Link, ExternalLink, Home, Lightbulb, MonitorPlay } from "lucide-react";
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
        name: "Homepage",
        icon: <Home className="h-4 w-4" />,
        endpoints: [
            {
                method: "GET",
                endpoint: "/api/xamaster/homepage",
                description: "Get homepage videos from xMaster",
                params: []
            }
        ]
    },
    {
        name: "Search Videos",
        icon: <Search className="h-4 w-4" />,
        endpoints: [
            {
                method: "GET",
                endpoint: "/api/xamaster/search",
                description: "Search for videos on xMaster",
                params: [
                    { name: "q", type: "string", required: true, description: "Search query" },
                    { name: "page", type: "number", required: false, description: "Page number (default: 1)" }
                ]
            },
            {
                method: "GET",
                endpoint: "/api/xamaster/search/suggestions",
                description: "Get search suggestions",
                params: [
                    { name: "q", type: "string", required: true, description: "Partial search query" }
                ]
            }
        ]
    },
    {
        name: "Video Details",
        icon: <MonitorPlay className="h-4 w-4" />,
        endpoints: [
            {
                method: "GET",
                endpoint: "/api/xamaster/video",
                description: "Get video details including sources",
                params: [
                    { name: "url", type: "string", required: false, description: "Full video URL" },
                    { name: "id", type: "string", required: false, description: "Video ID (if URL not provided)" }
                ]
            }
        ]
    }
];

interface XMasterDocsProps {
    apiKey: string;
    onApiKeyChange: (key: string) => void;
}

export default function XMasterDocs({ apiKey, onApiKeyChange }: XMasterDocsProps) {
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

    const handleEndpointChange = (endpointOnly: string) => {
        // Find endpoint in current category
        const endpoint = selectedCategory.endpoints.find(ep => ep.endpoint === endpointOnly);
        if (endpoint) {
            setSelectedEndpoint(endpoint);
            setTestParams({});
        }
    };

    const testApi = async () => {
        // API Key is optional for xMaster based on implementation but good practice to include in logic if user provides it
        // if (!apiKey) { ... }

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

            const queryParams = new URLSearchParams();
            Object.entries(testParams).forEach(([key, value]) => {
                if (value) {
                    queryParams.append(key, value);
                }
            });

            if (queryParams.toString()) {
                url += "?" + queryParams.toString();
            }

            const headers: HeadersInit = {
                "Content-Type": "application/json"
            };
            if (apiKey) {
                headers["x-api-key"] = apiKey;
            }

            const res = await fetch(url, { headers });

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
        const params = Object.entries(testParams).filter(([_, value]) => value);

        let url = selectedEndpoint.endpoint;
        const queryParams = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
        if (queryParams) {
            url += "?" + queryParams;
        }

        const baseUrl = "https://totu.me"; // Or current host

        switch (language) {
            case "javascript":
                if (selectedCategory.name === "Homepage") {
                    return `// Get homepage videos
const response = await fetch("${baseUrl}/api/xamaster/homepage");
const data = await response.json();
console.log(data.videos);`;
                } else if (selectedCategory.name === "Search Videos") {
                    if (selectedEndpoint.endpoint.includes('suggestions')) {
                        return `// Get search suggestions
const response = await fetch("${baseUrl}/api/xamaster/search/suggestions?q=teen");
const data = await response.json();
console.log(data);`;
                    }
                    return `// Search videos
const response = await fetch("${baseUrl}/api/xamaster/search?q=korean");
const data = await response.json();
console.log(data.videos);`;
                } else {
                    return `// Get video details
const response = await fetch("${baseUrl}/api/xamaster/video?url=https://xhamster.com/videos/example");
const data = await response.json();
console.log(data.videoDetails);`;
                }

            case "python":
                // Simplified python examples
                const pyUrl = `${baseUrl}${url}`;
                return `import requests\n\nresponse = requests.get("${pyUrl}")\ndata = response.json()\nprint(data)`;

            case "curl":
                return `curl -X GET "${baseUrl}${url}"`;

            default:
                return "";
        }
    };

    return (
        <div className="container mx-auto py-4 px-4 sm:py-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold truncate">xMaster API Documentation</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Test and explore xMaster video API endpoints
                    </p>
                </div>
            </div>

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
                                Enter your API key (optional for some endpoints).
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
                                <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey)} className="shrink-0">
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

                                <div className="space-y-2">
                                    <Label className="text-sm">Endpoint</Label>
                                    <Select value={selectedEndpoint.endpoint} onValueChange={handleEndpointChange}>
                                        <SelectTrigger className="text-sm w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedCategory.endpoints.map((endpoint) => (
                                                <SelectItem key={endpoint.endpoint} value={endpoint.endpoint} className="text-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Badge variant={endpoint.method === "GET" ? "default" : "secondary"} className="text-xs shrink-0">
                                                            {endpoint.method}
                                                        </Badge>
                                                        <code className="text-xs truncate min-w-0">{endpoint.endpoint}</code>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="p-3 bg-muted rounded-lg mt-2">
                                        <p className="text-xs sm:text-sm text-muted-foreground break-words">{selectedEndpoint.description}</p>
                                    </div>
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
                            <Textarea
                                placeholder="API response will appear here..."
                                value={response}
                                readOnly
                                className="min-h-[200px] sm:min-h-[300px] font-mono text-xs sm:text-sm w-full resize-none"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="docs" className="space-y-4 sm:space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Usage Examples</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="curl">
                                <TabsList>
                                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                                    <TabsTrigger value="python">Python</TabsTrigger>
                                    <TabsTrigger value="curl">cURL</TabsTrigger>
                                </TabsList>
                                <TabsContent value="curl">
                                    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800 p-4">
                                        <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
                                            {generateCodeExample("curl")}
                                        </pre>
                                    </div>
                                </TabsContent>
                                <TabsContent value="javascript">
                                    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800 p-4">
                                        <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
                                            {generateCodeExample("javascript")}
                                        </pre>
                                    </div>
                                </TabsContent>
                                <TabsContent value="python">
                                    <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800 p-4">
                                        <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
                                            {generateCodeExample("python")}
                                        </pre>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
