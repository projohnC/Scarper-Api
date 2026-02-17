const decode = function (value: string) {
  if (value === undefined) {
    return '';
  }
  return atob(value.toString());
};

const rot13 = function (str: string): string {
  return str.replace(/[a-zA-Z]/g, function (char) {
    const charCode = char.charCodeAt(0);
    const isUpperCase = char <= 'Z';
    const baseCharCode = isUpperCase ? 65 : 97;
    return String.fromCharCode(
      ((charCode - baseCharCode + 13) % 26) + baseCharCode,
    );
  });
};

const pen = function (value: string): string {
  return value.replace(/[a-zA-Z]/g, function (char: string) {
    const charCode = char.charCodeAt(0) + 13;
    const threshold = char <= 'Z' ? 90 : 122;
    return String.fromCharCode(
      threshold >= charCode ? charCode : charCode - 26,
    );
  });
};

const encode = function (value: string): string {
  return btoa(value.toString());
};

function decodeString(encryptedString: string): any {
  try {
    console.log('Starting decode with:', encryptedString);

    // First base64 decode
    let decoded = atob(encryptedString);
    console.log('After first base64 decode:', decoded);

    // Second base64 decode
    decoded = atob(decoded);
    console.log('After second base64 decode:', decoded);

    // ROT13 decode
    decoded = rot13(decoded);
    console.log('After ROT13 decode:', decoded);

    // Third base64 decode
    decoded = atob(decoded);
    console.log('After third base64 decode:', decoded);

    // Parse JSON
    const result = JSON.parse(decoded);
    console.log('Final parsed result:', result);
    return result;
  } catch (error) {
    console.error('Error decoding string:', error);

    // Try alternative decoding approaches
    try {
      console.log('Trying alternative decode approach...');
      let altDecoded = atob(encryptedString);
      altDecoded = atob(altDecoded);
      const altResult = JSON.parse(altDecoded);
      console.log('Alternative decode successful:', altResult);
      return altResult;
    } catch (altError) {
      console.error('Alternative decode also failed:', altError);
      return null;
    }
  }
}

async function getRedirectLinks(link: string): Promise<string> {
  try {
    const res = await fetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    const resText = await res.text();

    const regex = /ck\('_wp_http_\d+','([^']+)'/g;
    let combinedString = '';

    let match;
    while ((match = regex.exec(resText)) !== null) {
      combinedString += match[1];
    }

    const decodedString = decode(pen(decode(decode(combinedString))));
    const data = JSON.parse(decodedString);
    console.log('Redirect data:', data);

    const token = encode(data?.data);
    const blogLink = data?.wp_http1 + '?re=' + token;

    // Wait for the required time
    const waitTime = (Number(data?.total_time) + 3) * 1000;
    console.log(`Waiting ${waitTime}ms before proceeding...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    console.log('Blog link:', blogLink);

    let vcloudLink = 'Invalid Request';
    let attempts = 0;
    const maxAttempts = 5;

    while (vcloudLink.includes('Invalid Request') && attempts < maxAttempts) {
      const blogRes = await fetch(blogLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      const blogText = await blogRes.text();

      if (blogText.includes('Invalid Request')) {
        console.log('Invalid request, retrying...');
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        const reurlMatch = blogText.match(/var reurl = "([^"]+)"/);
        if (reurlMatch) {
          vcloudLink = reurlMatch[1];
          break;
        }
      }
    }

    return vcloudLink;
  } catch (err) {
    console.log('Error in getRedirectLinks:', err);
    return link;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const link = searchParams.get('link');

    if (!link) {
      return Response.json(
        { error: 'Link parameter is required' },
        { status: 400 }
      );
    }

    console.log('Processing gadget link:', link);

    // Fetch the page content
    const res = await fetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    const text = await res.text();
    
    // Extract the encrypted string from the response
    const encryptedString = text.split("s('o','")?.[1]?.split("',180")?.[0];
    console.log('Encrypted string:', encryptedString);

    if (!encryptedString) {
      return Response.json(
        { error: 'Could not extract encrypted string from response' },
        { status: 400 }
      );
    }

    // Decode the encrypted string
    const decodedData: any = decodeString(encryptedString);
    console.log('Decoded data:', decodedData);

    if (!decodedData?.o) {
      return Response.json(
        { error: 'Invalid decoded data structure' },
        { status: 400 }
      );
    }

    // Extract the actual link
    const decodedLink = atob(decodedData.o);
    console.log('Decoded link:', decodedLink);

    // Get the final redirect link
    const finalLink = await getRedirectLinks(decodedLink);
    console.log('Final redirect link:', finalLink);

    return Response.json({
      success: true,
      originalLink: link,
      decodedLink: decodedLink,
      finalLink: finalLink,
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return Response.json(
      { 
        error: 'Failed to process link',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
