const db = require("../config/db");

exports.getComparationBarChart = async (req, res) => {
    try {
        const pairs = [
            // { key: "margaritavillerestaurants", value: "AME", label: "Margaritaville" },
            { key: "auntieannes", value: "AAP", label: "Auntie Anne's" },
            // { key: "blazepizza", value: "BPA", label: "Blaze Pizza" },
            { key: "burgerking", value: "BKG", label: "Burger King" },
            // { key: "carrabbas", value: "CAS", label: "Carrabba's" },
            { key: "chickfila", value: "CFA", label: "Chick-fil-A" },
            { key: "chilis", value: "CHI", label: "Chili's" },
            { key: "cinnabon", value: "CIN", label: "Cinnabon" },
            { key: "dunkin", value: "DDS", label: "Dunkin'" },
            { key: "firehousesubs", value: "FHS", label: "Firehouse Subs" },
            // { key: "jimmyjohns", value: "JYJ", label: "Jimmy John's" },
            // { key: "longhornsteakhouse", value: "LSE", label: "LongHorn" },
            // { key: "maggianos", value: "MAG", label: "Maggiano's" },
            // { key: "outbacksteakhouse", value: "OUT", label: "Outback" },
            { key: "pandaexpress", value: "PES", label: "Panda Express" },
            { key: "popeyes", value: "POP", label: "Popeyes" },
            // { key: "shakeshack", value: "SSA", label: "Shake Shack" },
            { key: "smashburger", value: "SMA", label: "Smashburger" },
        ];

        const airportName =
            req.body.airportName &&
                req.body.airportName !== "null" &&
                req.body.airportName !== "undefined"
                ? req.body.airportName.trim()
                : null;

        const restaurantName =
            req.body.restaurantName &&
                req.body.restaurantName !== "null" &&
                req.body.restaurantName !== "undefined"
                ? req.body.restaurantName.trim()
                : null;

        // Filter restaurant if selected from dropdown
        const filteredRestaurants = restaurantName
            ? pairs.filter(
                (p) =>
                    p.key.toLowerCase() === restaurantName.toLowerCase() ||
                    p.value.toLowerCase() === restaurantName.toLowerCase() ||
                    p.label.toLowerCase() === restaurantName.toLowerCase()
            )
            : pairs;

        const results = await Promise.all(
            filteredRestaurants.map(async (pair) => {
                // Snowflake Count
                let snowflakeQuery =
                    "SELECT COUNT(*) AS count FROM snowflake_data WHERE CONCEPT_ID = ?";
                const snowflakeParams = [pair.value];

                if (airportName) {
                    snowflakeQuery += " AND BUSINESS_UNIT_NAME = ?";
                    snowflakeParams.push(airportName);
                }

                const [sCount] = await db.query(
                    snowflakeQuery,
                    snowflakeParams
                );

                // BPT Count
                let bptQuery = `
                    SELECT COUNT(*) AS count
                    FROM bpt_data
                    WHERE REGEXP_REPLACE(
                        LOWER(\`Restaurant Name\`),
                        '[^a-z0-9]',
                        ''
                    ) = ?
                `;

                const bptParams = [pair.key];

                // if (airportName) {
                //     bptQuery += " AND \`Airport Name\` = ?";
                //     bptParams.push(airportName);
                // }

                const [bCount] = await db.query(
                    bptQuery,
                    bptParams
                );

                // Matched Count
                let matchedQuery = `
                    SELECT COUNT(DISTINCT b.\`POS Ref\`) AS count
                    FROM auth_db.bpt_data b
                    INNER JOIN auth_db.snowflake_data s
                        ON s.MENU_ITEM_ID = b.\`POS Ref\`
                    WHERE s.CONCEPT_ID = ?
                    AND REGEXP_REPLACE(
                        LOWER(b.\`Restaurant Name\`),
                        '[^a-z0-9]',
                        ''
                    ) = ?
                `;

                const matchedParams = [pair.value, pair.key];


               if (airportName) {
                   matchedQuery += " AND s.BUSINESS_UNIT_NAME = ?";
                   matchedParams.push(airportName);
             }

                const [mCount] = await db.query(
                    matchedQuery,
                    matchedParams
                );

                return {
                    restaurantName: pair.label,
                    snowflakeCount: parseInt(
                        sCount?.[0]?.count ?? 0,
                        10
                    ),
                    bptCount: parseInt(
                        bCount?.[0]?.count ?? 0,
                        10
                    ),
                    matchedCount: parseInt(
                        mCount?.[0]?.count ?? 0,
                        10
                    ),
                };
            })
        );

        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error("getComparationBarChart Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};