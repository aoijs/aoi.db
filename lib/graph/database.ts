import { List } from "./list";
import { Node } from "./node";

export class GraphDb {
    #edges: Map<unknown, Map<number, number>> = new Map<
        unknown,
        Map<number, number>
    >();
    #nodes: List<"list"> = new List("list");
    constructor ()
    {
        
    }
}
