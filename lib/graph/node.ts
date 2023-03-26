import { NodeData } from './../typings/interface';
export class Node
{
    key: unknown;
    value: unknown;
    id: number;
    cont: Node | null;
    parent: Node | null;
    constructor ( data: NodeData )
    {
        this.key = data.key;
        this.value = data.value;
        this.cont = null;
        this.parent = null;
        this.id = data.id;
    }
}