import { Money } from "@/components/Money";
import type { OrderItem } from "@/lib/types";

interface OrderItemsTableProps {
  items: OrderItem[];
  showPrice?: boolean;
  currency?: string;
}

export function OrderItemsTable({
  items,
  showPrice = true,
  currency = "PKR",
}: OrderItemsTableProps) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">No items on this order.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table role="table" className="w-full">
        <thead>
          <tr>
            <th scope="col" className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
              SKU
            </th>
            <th scope="col" className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
              Name
            </th>
            <th scope="col" className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-ink-muted uppercase tracking-wider">
              Quantity
            </th>
            {showPrice && (
              <>
                <th scope="col" className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-ink-muted uppercase tracking-wider">
                  Unit Price
                </th>
                <th scope="col" className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-ink-muted uppercase tracking-wider">
                  Line Total
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 font-mono text-xs">
                {item.sku}
              </td>
              <td className="px-4 py-3 text-sm text-ink border-t border-gray-100">
                {item.name}
              </td>
              <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right">
                {item.quantity}
              </td>
              {showPrice && (
                <>
                  <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right">
                    <Money value={item.unit_price} currency={currency} />
                  </td>
                  <td className="px-4 py-3 text-sm text-ink border-t border-gray-100 text-right">
                    <Money value={item.total_price} currency={currency} />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
