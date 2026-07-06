-- ===== MySQL 索引脚本 =====

CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_wh_user_date ON workhour_records(user_id, record_date);
CREATE INDEX idx_ded_user_month ON salary_deductions(user_id, month);
CREATE INDEX idx_exp_user_month ON salary_expenses(user_id, month);
CREATE INDEX idx_adv_user_month ON salary_advances(user_id, month);
CREATE INDEX idx_bill_user_month ON salary_bills(user_id, month);
CREATE INDEX idx_det_user_time ON detection_records(user_id, created_at);
CREATE INDEX idx_settings_user ON user_settings(user_id);
CREATE INDEX idx_legal_category ON legal_articles(category);
CREATE INDEX idx_agreements_user_type ON user_agreements(user_id, agreement_type);
