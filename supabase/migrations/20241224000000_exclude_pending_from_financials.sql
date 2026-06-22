-- Update get_monthly_financials function to exclude pending transactions
CREATE OR REPLACE FUNCTION "public"."get_monthly_financials"("p_month" integer, "p_year" integer) RETURNS TABLE("gross_revenue" numeric, "net_revenue" numeric, "creator_payouts" numeric, "platform_fees" numeric, "total_transactions" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
BEGIN
    -- Set the start and end dates for the given month and year
    start_date := make_timestamptz(p_year, p_month, 1, 0, 0, 0);
    end_date := start_date + interval '1 month';

    RETURN QUERY
    WITH all_transactions AS (
        -- Union all transaction types into a single set for aggregation - exclude pending
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM tip_transactions WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM ppv_transactions WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM subscription_payments WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        SELECT amount_cents, platform_share_cents, creator_share_cents FROM creator_product_transactions WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
        UNION ALL
        -- Credit purchases are 100% platform revenue - exclude pending
        SELECT amount_cents, amount_cents AS platform_share_cents, 0 AS creator_share_cents FROM credit_transactions WHERE created_at >= start_date AND created_at < end_date AND status != 'pending'
    )
    SELECT
        -- Gross Revenue: Sum of all transaction amounts before any splits
        COALESCE(SUM(t.amount_cents), 0)::NUMERIC AS gross_revenue,
        -- Net Revenue: The platform's share from all transactions
        COALESCE(SUM(t.platform_share_cents), 0)::NUMERIC AS net_revenue,
        -- Creator Payouts: The creators' share from all transactions
        COALESCE(SUM(t.creator_share_cents), 0)::NUMERIC AS creator_payouts,
        -- Platform Fees: A placeholder calculation for payment processor fees (e.g., Stripe's 2.9% + 30¢)
        (COALESCE(SUM(t.amount_cents * 0.029 + 30), 0))::NUMERIC AS platform_fees,
        -- Total Transactions: A simple count of all transactions in the period
        COUNT(t.*)::BIGINT AS total_transactions
    FROM all_transactions t;
END;
$$;

