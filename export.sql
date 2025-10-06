-- Export of sample mempool monitoring data
-- Run these statements in your target database

-- Insert pending transactions
INSERT INTO pending_transactions (tx_hash, from_address, to_address, value, gas_price, max_fee_per_gas, max_priority_fee_per_gas, gas_limit, input_data, nonce, detected_at) VALUES
('0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890', '0x742d35cc6634c0532925a3b844bc9e7595f0beb1', '0x10ed43c718714eb63d5aa57b78b54704e256024e', '1000000000000000000', '5000000000', NULL, NULL, '200000', '0x38ed1739000000000000000000000000000000000000000000000000016345785d8a0000', 1, '2025-10-06 04:27:57.239562+00'),
('0x2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567891', '0x8894e0a0c962cb723c1976a4421c95949be2d4e3', '0x10ed43c718714eb63d5aa57b78b54704e256024e', '500000000000000000', '5000000000', NULL, NULL, '250000', '0xe8e33700', 2, '2025-10-06 04:29:57.239562+00'),
('0x3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567892', '0x5b38da6a701c568545dcfcb03fcb875f56beddc4', NULL, '0', '5000000000', NULL, NULL, '3000000', '0x608060405234801561001057600080fd5b50', 0, '2025-10-06 04:30:57.239562+00'),
('0x4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567893', '0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2', '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', '0', '5000000000', NULL, NULL, '100000', '0xa9059cbb', 3, '2025-10-06 04:31:57.239562+00'),
('0x5e6f7890abcdef1234567890abcdef1234567890abcdef1234567894', '0x4b20993bc481177ec7e8f571cecae8a9e22c02db', '0x10ed43c718714eb63d5aa57b78b54704e256024e', '2000000000000000000', '6000000000', NULL, NULL, '200000', '0x38ed1739', 1, '2025-10-06 04:32:27.239562+00');

-- Insert transaction classifications
INSERT INTO transaction_classifications (tx_hash, classification_type, confidence, method_signature, router_address, metadata, classified_at) VALUES
('0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890', 'swap', 0.95, '0x38ed1739', '0x10ed43c718714eb63d5aa57b78b54704e256024e', '{"hasValue":true,"gasLimit":"high"}', '2025-10-06 04:27:57.239562+00'),
('0x2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567891', 'add_liquidity', 0.88, '0xe8e33700', '0x10ed43c718714eb63d5aa57b78b54704e256024e', '{"hasValue":true}', '2025-10-06 04:29:57.239562+00'),
('0x3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567892', 'contract_deploy', 0.99, '0x60806040', NULL, '{"gasLimit":"very_high"}', '2025-10-06 04:30:57.239562+00'),
('0x4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567893', 'token_transfer', 0.92, '0xa9059cbb', '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', '{"tokenContract":"WBNB"}', '2025-10-06 04:31:57.239562+00'),
('0x5e6f7890abcdef1234567890abcdef1234567890abcdef1234567894', 'swap', 0.91, '0x38ed1739', '0x10ed43c718714eb63d5aa57b78b54704e256024e', '{"hasValue":true}', '2025-10-06 04:32:27.239562+00');

-- Insert mined transactions
INSERT INTO mined_transactions (tx_hash, block_number, block_hash, transaction_index, status, gas_used, effective_gas_price, mined_at) VALUES
('0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890', 18500000, '0xabc123def456', 42, 1, '185000', '5000000000', '2025-10-06 04:28:12.239562+00'),
('0x2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567891', 18500001, '0xdef789abc012', 15, 1, '230000', '5000000000', '2025-10-06 04:30:12.239562+00'),
('0x3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567892', 18500002, '0x123456789abc', 8, 1, '2850000', '5000000000', '2025-10-06 04:31:12.239562+00');

-- Insert analysis metrics
ERROR:  42703: column "time_to_mine" of relation "analysis_metrics" does not exist
LINE 1: INSERT INTO analysis_metrics (tx_hash, was_mined, prediction_correct, time_to_mine, actual_gas_used, created_at) VALUES