// Supabase Edge Function - 微信小程序登录获取 open_id
// 
// 部署步骤：
// 1. 在项目根目录创建 supabase-edge-functions/wechat-login/index.ts
// 2. 在 Supabase Dashboard → Edge Functions → New Function
// 3. 命名为 "wechat-login"
// 4. 将此文件内容粘贴进去
// 5. 在 Secrets 中配置：
//    - WECHAT_APPID: 你的微信小程序 appid
//    - WECHAT_SECRET: 你的微信小程序 appsecret

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ error: '缺少 code 参数' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 从环境变量获取微信小程序配置
    const appid = Deno.env.get('WECHAT_APPID')
    const appsecret = Deno.env.get('WECHAT_SECRET')

    if (!appid || !appsecret) {
      console.error('微信小程序配置缺失')
      return new Response(
        JSON.stringify({ error: '服务器配置错误' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 调用微信接口获取 open_id
    const wechatUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${appsecret}&js_code=${code}&grant_type=authorization_code`
    
    const wechatResponse = await fetch(wechatUrl)
    const wechatData = await wechatResponse.json()

    console.log('微信返回数据:', wechatData)

    if (wechatData.errcode) {
      return new Response(
        JSON.stringify({ error: wechatData.errmsg }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 返回 open_id 和 session_key
    return new Response(
      JSON.stringify({
        openid: wechatData.openid,
        session_key: wechatData.session_key,
        unionid: wechatData.unionid
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('登录错误:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})