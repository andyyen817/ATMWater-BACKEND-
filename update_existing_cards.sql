-- 将所有现有的物理卡的 issuedBy 设置为 NULL（未分配状态）
-- 这样所有总部录入的卡都会显示为"未分配"
UPDATE physical_cards SET issuedBy = NULL WHERE issuedBy IS NOT NULL;
