# XMaster API Documentation

This directory contains API routes for the XMaster integration, providing access to homepage feeds, search functionality, and search suggestions.

## Base URL
All routes are relative to: `/api/xamaster`

---

## 1. Homepage Feed
**Endpoint:** `GET /homepage`

Fetches an aggregated list of videos from the first 5 pages of the xHamster homepage.

### Parameters
None

### Response Object
A JSON object containing an array of video objects.

```json
{
  "videos": [
    {
      "id": 1234567,
      "title": "Example Video Title",
      "duration": 600,
      "created": 1672531200,
      "videoType": "video",
      "pageURL": "https://xhamster.com/videos/...",
      "thumbURL": "https://...",
      "imageURL": "https://...",
      "previewThumbURL": "https://...",
      "spriteURL": "https://...",
      "trailerURL": "https://...",
      "views": 15000,
      "landing": {
        "type": "channel",
        "id": 987,
        "name": "Channel Name",
        "logo": "https://...",
        "link": "https://...",
        "subscribers": 5000
      }
    }
  ]
}
```

---

## 2. Search
**Endpoint:** `GET /search`

Searches for videos based on a keyword.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | The search query (e.g., "cats"). |
| `page` | number | No | Page number for pagination (defaults to 1). |

### Response Object
Returns search results, pagination details, and related suggestions.

```json
{
  "success": true,
  "query": "cats",
  "encodedQuery": "cats",
  "page": 1,
  "searchUrl": "https://xhamster.com/search/cats?page=1",
  "totalResults": 5000,
  "suggestions": [
    { "label": "cats meowing", "url": "https://..." }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 50,
    "hasNextPage": true,
    "hasPrevPage": false,
    "pages": [
        { "page": 1, "url": "...", "active": true, "isVisible": true },
        { "page": 2, "url": "...", "active": false, "isVisible": true }
    ]
  },
  "videos": [
    {
       "id": "123",
       "title": "Funny Cat Video",
       "duration": "03:45",
       "views": 2000,
       "thumbURL": "...",
       "uploader": { 
           "name": "CatLover",
           "url": "..." 
       }
    }
  ],
  "totalVideos": 42
}
```

---

## 3. Search Suggestions
**Endpoint:** `GET /search/suggestions`

Provides autocomplete suggestions for a partial search query.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | The input text to get suggestions for. |

### Response Object

```json
{
  "success": true,
  "query": "asm",
  "suggestions": [
    {
      "text": "asmr",
      "count": 50000,
      "link": "https://xhamster.com/search/asmr"
    }
  ],
  "totalSuggestions": 1
}
```

---

## 4. Video (Pending Implementation)
**Endpoint:** `GET /video`

*Current Status:* This endpoint currently contains logic identical to the Search Suggestions endpoint (`GET /search/suggestions`). 

**Note for Developers:**
It appears `app/api/xamaster/video/route.ts` is a copy of `app/api/xamaster/search/suggestions/route.ts`. It likely needs to be updated to fetch specific video details (e.g., by taking a `id` or `url` parameter).
