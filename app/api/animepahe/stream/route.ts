import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const STATIC_COOKIE =
  "__ddgid_=GIsAbopI81hATr14; __ddgmark_=PZvu2hO7knFJVjvc; __ddg2_=wxrBAhJcnT8W4igZ; __ddg1_=ytxmCXeUPhCjALFThP2b; res=720; aud=jpn; av1=0; latest=6441; __ddg9_=152.59.142.57; __ddg8_=egtCqGg0LH65LlEO; __ddg10_=1769617869; XSRF-TOKEN=eyJpdiI6IkdxdUo0aTJUYjg3eWUyc3l2cDFuaGc9PSIsInZhbHVlIjoiK1BLeEFySTJLdFV0c2pVVlJIMFp3a0Fqa0hSTlFyck9YeWY2all4WXVjd0J5UjM2SEFGdCtVZ1FyUjVyNGRjYkFLRWJRQzdONnZlMXZVZEs5YUVsaUdxRXhraFRUT2theVRDbEdLR2NkNHcyU1duRHFrejRCUjIyMEdKOWQ4cEwiLCJtYWMiOiI2OGZjZTBjNWRhZjUwMjJmODRkYjNkNThlMmI0M2Q2YWVmNGI0NGQwMmY0NDQ4ODNmMmQyZmM2NWExZDU2YzJkIiwidGFnIjoiIn0%3D; laravel_session=eyJpdiI6IklQekYvdGQ3QXdwK1oyeWNGdnkvR0E9PSIsInZhbHVlIjoicXNuSkZjZ0lVMWs1bXZRZmFJTmk0N2hoVDYxSHl3S1pQMmExLzdQRVYxUzhPeFUvTllkdXZOQkFCY3J3RW9Tb2FZM0hudGpKL25jTmNTaDhxWHdqbzVidE4vME9lODNXTlN1MmZjNFNZVVEwc25wL1IvYUVCQURNRk45dW56aVIiLCJtYWMiOiIzNWZmZjU5YjRiNzVhNzQ1Y2I5ZDkwNWNiMTdlODdiNjFmOTY2NjFhNjRmNjY5MGU0OTMyODRjNTJmMGZjYTA4IiwidGFnIjoiIn0%3D";

// Dean Edwards packer unpacker
function deobfuscateCode(packedCode: string): string {
  try {
    const match = packedCode.match(
      /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/
    );

    if (!match) return "";

    const payload = match[1];
    const base = parseInt(match[2]);
    const count = parseInt(match[3]);
    const keywords = match[4].split("|");

    // Unpacking function
    const unpack = (p: string, a: number, c: number, k: string[]): string => {
      while (c--) {
        if (k[c]) {
          const regex = new RegExp("\\b" + baseN(c, a) + "\\b", "g");
          p = p.replace(regex, k[c]);
        }
      }
      return p;
    };

    const baseN = (num: number, base: number): string => {
      if (num < base) {
        return num < 36
          ? num.toString(36)
          : String.fromCharCode(num + 29);
      }
      return baseN(Math.floor(num / base), base) + baseN(num % base, base);
    };

    return unpack(payload, base, count, keywords);
  } catch (error) {
    console.error("Error deobfuscating code:", error);
    return "";
  }
}

function extractM3u8Url(code: string): string {
  const patterns = [
    /(?:var|let|const)\s+q\s*=\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/,
    /['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/,
    /url\s*:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return "";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "url parameter is required",
        },
        { status: 400 }
      );
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: STATIC_COOKIE,
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    let m3u8Url = "";

    $("script").each((_, elem) => {
      const scriptContent = $(elem).html() || "";

      if (scriptContent.includes("eval(function(p,a,c,k,e,d)")) {
        const evalMatches = scriptContent.match(
          /eval\(function\(p,a,c,k,e,d\)[\s\S]+?\}\('[\s\S]+?',\d+,\d+,'[\s\S]+?'\.split\('\|'\),\d+,\{\}\)\)/g
        );

        if (evalMatches) {
          for (const evalBlock of evalMatches) {
            const deobfuscated = deobfuscateCode(evalBlock);
            const extractedUrl = extractM3u8Url(deobfuscated);

            if (extractedUrl) {
              m3u8Url = extractedUrl;
              break;
            }
          }
        }
      }

      if (!m3u8Url) {
        const directMatch = scriptContent.match(
          /['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/
        );
        if (directMatch && directMatch[1]) {
          m3u8Url = directMatch[1];
        }
      }
    });

    if (!m3u8Url) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not find m3u8 URL in the page",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        m3u8_url: m3u8Url,
        source_url: url,
      },
    });
  } catch (error) {
    console.error("Error fetching stream:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch stream",
      },
      { status: 500 }
    );
  }
}
