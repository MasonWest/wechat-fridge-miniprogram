// Supabase Edge Function - 腾讯云 OCR 识别
// 部署步骤：
// 1. 在 Supabase Dashboard → Edge Functions → New Function
// 2. 命名为 "ocr-recognition"
// 3. 将此文件内容粘贴进去
// 4. 在 Secrets 中配置：
//    - TENCENT_SECRET_ID: 腾讯云 SecretId
//    - TENCENT_SECRET_KEY: 腾讯云 SecretKey

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 腾讯云配置
const TENCENT_CONFIG = {
  region: 'ap-beijing',
  endpoint: 'ocr.tencentcloudapi.com',
  action: 'GeneralBasicOCR',
  version: '2018-11-19',
  service: 'ocr'
}

/**
 * SHA256 哈希函数
 */
async function getHash(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * HMAC-SHA256 函数
 */
async function sha256(message: string, secret: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return new Uint8Array(signature)
}

/**
 * 获取日期字符串 (UTC)
 */
function getDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 调用腾讯云 OCR
 */
async function callTencentOCR(imageBase64: string) {
  // 获取环境变量
  const secretId = Deno.env.get('TENCENT_SECRET_ID')
  const secretKey = Deno.env.get('TENCENT_SECRET_KEY')

  if (!secretId || !secretKey) {
    throw new Error('腾讯云配置缺失')
  }

  // 获取当前时间
  const timestamp = Math.floor(Date.now() / 1000)
  const date = getDate(timestamp)

  // 请求参数
  const payload = `{"ImageBase64":"${imageBase64}"}`

  // ************* 步骤 1：拼接规范请求串 *************
  const signedHeaders = "content-type;host"
  const hashedRequestPayload = await getHash(payload)
  const httpRequestMethod = "POST"
  const canonicalUri = "/"
  const canonicalQueryString = ""
  const canonicalHeaders =
    "content-type:application/json; charset=utf-8\n" +
    "host:" + TENCENT_CONFIG.endpoint + "\n"

  const canonicalRequest =
    httpRequestMethod +
    "\n" +
    canonicalUri +
    "\n" +
    canonicalQueryString +
    "\n" +
    canonicalHeaders +
    "\n" +
    signedHeaders +
    "\n" +
    hashedRequestPayload

  // ************* 步骤 2：拼接待签名字符串 *************
  const algorithm = "TC3-HMAC-SHA256"
  const hashedCanonicalRequest = await getHash(canonicalRequest)
  const credentialScope = date + "/" + TENCENT_CONFIG.service + "/" + "tc3_request"
  const stringToSign =
    algorithm +
    "\n" +
    timestamp +
    "\n" +
    credentialScope +
    "\n" +
    hashedCanonicalRequest

  // ************* 步骤 3：计算签名 *************
  const kDate = await sha256(date, new TextEncoder().encode('TC3' + secretKey))
  const kService = await sha256(TENCENT_CONFIG.service, kDate)
  const kSigning = await sha256("tc3_request", kService)
  const signature = Array.from(await sha256(stringToSign, kSigning)).map(b => b.toString(16).padStart(2, '0')).join('')

  // ************* 步骤 4：拼接 Authorization *************
  const authorization =
    algorithm +
    " " +
    "Credential=" +
    secretId +
    "/" +
    credentialScope +
    ", " +
    "SignedHeaders=" +
    signedHeaders +
    ", " +
    "Signature=" +
    signature

  // ************* 步骤 5：构造并发起请求 *************
  const url = `https://${TENCENT_CONFIG.endpoint}/`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json; charset=utf-8',
      'Host': TENCENT_CONFIG.endpoint,
      'X-TC-Action': TENCENT_CONFIG.action,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Version': TENCENT_CONFIG.version,
      'X-TC-Region': TENCENT_CONFIG.region
    },
    body: payload
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('腾讯云 API 错误:', JSON.stringify(data))
    throw new Error(data.Response?.Error?.Message || 'OCR 调用失败')
  }

  // 检查响应体中是否包含错误
  if (data.Response && data.Response.Error) {
    console.error('腾讯云 API 错误:', JSON.stringify(data.Response.Error))
    throw new Error(data.Response.Error.Message || 'OCR 调用失败')
  }

  console.log('OCR 识别成功')

  return data.Response
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: '缺少图片数据' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('收到 OCR 请求，图片长度:', imageBase64.length)

    // 调用腾讯云 OCR
    const ocrResult = await callTencentOCR(imageBase64)

    return new Response(
      JSON.stringify(ocrResult),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('OCR 识别失败:', error)
    return new Response(
      JSON.stringify({ error: error.message || '识别失败' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})