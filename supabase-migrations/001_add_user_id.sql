-- 数据库迁移：添加 user_id 字段用于数据隔离
-- 执行步骤：
-- 1. 在 Supabase Dashboard → SQL Editor 中执行此 SQL
-- 2. 或者使用 Supabase CLI: supabase db push

-- 为 pantry_items 表添加 user_id 字段
ALTER TABLE pantry_items 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 为 custom_locations 表添加 user_id 字段
ALTER TABLE custom_locations 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 为现有数据设置默认 user_id（临时使用当前 UUID）
-- 注意：这只是一个临时措施，用户需要重新登录后才能正常使用
-- UPDATE pantry_items SET user_id = 'your-temp-user-id' WHERE user_id IS NULL;
-- UPDATE custom_locations SET user_id = 'your-temp-user-id' WHERE user_id IS NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_locations_user_id ON custom_locations(user_id);

-- 添加注释
COMMENT ON COLUMN pantry_items.user_id IS '微信小程序用户 open_id，用于数据隔离';
COMMENT ON COLUMN custom_locations.user_id IS '微信小程序用户 open_id，用于数据隔离';

-- 迁移完成提示
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '迁移完成！user_id 字段已添加';
  RAISE NOTICE '========================================';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 在 Supabase Edge Functions 中创建 wechat-login 函数';
  RAISE NOTICE '2. 配置 WECHAT_APPID 和 WECHAT_SECRET 环境变量';
  RAISE NOTICE '3. 修改小程序代码，调用登录接口获取 open_id';
  RAISE NOTICE '4. 执行 RLS 策略设置（见 002_setup_rls.sql）';
  RAISE NOTICE '========================================';
END $$;