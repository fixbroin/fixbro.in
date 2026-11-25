import { NextRequest, NextResponse } from 'next/server';
import { getPool, ensureTableExists } from '@/lib/mysql';
import { verifyRequest, isUserAdmin } from '@/lib/dbSecurity';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user || !isUserAdmin(user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitVal = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const offsetVal = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const country = (searchParams.get('country') || '').trim();
    const foreignOnly = searchParams.get('foreignOnly') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';

    const pool = await getPool();
    await ensureTableExists(pool, 'visitorInfoLogs');

    const conditions: string[] = [];
    const params: any[] = [];

    if (country) {
      conditions.push(`LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.countryName')), '')) = LOWER(?)`);
      params.push(country);
    }

    if (foreignOnly) {
      conditions.push(`LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.countryName')), '')) != 'india'`);
    }

    if (search) {
      const likePattern = `%${search}%`;
      conditions.push(`(
        LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.ipAddress')), '')) LIKE ? OR
        LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')), '')) LIKE ? OR
        LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.countryName')), '')) LIKE ? OR
        LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.pathname')), '')) LIKE ? OR
        LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.ispOrganization')), '')) LIKE ?
      )`);
      params.push(likePattern, likePattern, likePattern, likePattern, likePattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch paginated matching logs + total matching count
    const countPromise = pool.query(
      `SELECT COUNT(*) as total FROM \`visitorInfoLogs\` ${whereClause}`,
      params
    );
    const logsPromise = pool.query(
      `SELECT \`id\`, \`data\`, \`createdAt\` FROM \`visitorInfoLogs\` ${whereClause} ORDER BY \`createdAt\` DESC LIMIT ? OFFSET ?`,
      [...params, limitVal, offsetVal]
    );

    let stats: any = undefined;

    if (includeStats) {
      const [
        [countRes],
        [logsRes],
        [overallRes],
        [countryRes],
        [topCityRes],
        [topPathRes],
        [trendRes],
      ]: any = await Promise.all([
        countPromise,
        logsPromise,
        pool.query(`SELECT COUNT(*) as totalVisits, COUNT(DISTINCT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.ipAddress')), '')) as uniqueVisitors FROM \`visitorInfoLogs\``),
        pool.query(`SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.countryName')), ''), 'Unknown Country') as name, COUNT(*) as value FROM \`visitorInfoLogs\` GROUP BY name ORDER BY value DESC LIMIT 10`),
        pool.query(`SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.city')), ''), 'Unknown City') as name, COUNT(*) as value FROM \`visitorInfoLogs\` GROUP BY name ORDER BY value DESC LIMIT 1`),
        pool.query(`SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.pathname')), ''), '/') as name, COUNT(*) as value FROM \`visitorInfoLogs\` GROUP BY name ORDER BY value DESC LIMIT 1`),
        pool.query(`SELECT DATE_FORMAT(\`createdAt\`, '%b %d') as name, DATE(\`createdAt\`) as sortDate, COUNT(*) as value FROM \`visitorInfoLogs\` WHERE \`createdAt\` >= DATE_SUB(NOW(), INTERVAL 14 DAY) GROUP BY sortDate, name ORDER BY sortDate ASC`),
      ]);

      const totalVisits = Number(overallRes[0]?.totalVisits || 0);
      const uniqueVisitors = Number(overallRes[0]?.uniqueVisitors || 0);
      const countryData = (countryRes || []).map((r: any) => ({
        name: String(r.name),
        value: Number(r.value || 0),
        percentage: totalVisits > 0 ? Number(((Number(r.value || 0) / totalVisits) * 100).toFixed(1)) : 0,
      }));
      const trendData = (trendRes || []).map((r: any) => ({
        name: String(r.name),
        value: Number(r.value || 0),
      }));

      stats = {
        totalVisits,
        uniqueVisitors,
        topCity: topCityRes[0]?.name || 'N/A',
        topPath: topPathRes[0]?.name || '/',
        countryData,
        trendData,
      };

      const filteredTotal = Number(countRes[0]?.total || 0);
      const logs = (logsRes || []).map((row: any) => {
        const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        return {
          id: row.id,
          ...parsed,
          timestamp: parsed.timestamp || (row.createdAt ? new Date(row.createdAt).toISOString() : undefined),
        };
      });

      return NextResponse.json({
        success: true,
        logs,
        filteredTotal,
        hasMore: offsetVal + logs.length < filteredTotal,
        stats,
      });
    }

    const [[countRes], [logsRes]]: any = await Promise.all([countPromise, logsPromise]);
    const filteredTotal = Number(countRes[0]?.total || 0);
    const logs = (logsRes || []).map((row: any) => {
      const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return {
        id: row.id,
        ...parsed,
        timestamp: parsed.timestamp || (row.createdAt ? new Date(row.createdAt).toISOString() : undefined),
      };
    });

    return NextResponse.json({
      success: true,
      logs,
      filteredTotal,
      hasMore: offsetVal + logs.length < filteredTotal,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/visitor-info:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user || !isUserAdmin(user)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const pool = await getPool();
    await ensureTableExists(pool, 'visitorInfoLogs');
    await pool.query(`DELETE FROM \`visitorInfoLogs\``);

    return NextResponse.json({ success: true, message: 'All visitor logs cleared.' });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/visitor-info:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to clear logs' }, { status: 500 });
  }
}
