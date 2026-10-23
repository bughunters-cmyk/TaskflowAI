#include <stdio.h>

int col(int column)
{
    if (column == 1) return 1;
    if (column == 2) return 4;
    return 7;
}

int main(void)
{
    
    char game[6][9];
    for (int i = 0; i < 6; i++)
    {
        for (int j = 0; j < 8; j++)
        {
            if ((j + 1) % 3 == 0)
            {
                game[i][j] = '|';
            }
            else if (i % 2 == 1)
            {
                game[i][j] = '_';
            }
            else
            {
                game[i][j] = ' ';
            }
        }
        game[i][8] = '\0'; 
    }

    int row, column;

    for (int turn = 0; turn < 9; turn++)
    {
        char current_player = (turn % 2 == 0) ? 'X' : 'O';
        printf("--- Turn %d: Player (%c) ---\n", turn + 1, current_player);

        int target_row, target_col;
        while (1)
        {
            printf("Enter column (1-3): ");
            scanf("%d", &column);
            while (column < 1 || column > 3)
            {
                printf("Error! Enter column between 1 and 3: ");
                scanf("%d", &column);
            }

            printf("Enter row (1-3): ");
            scanf("%d", &row);
            while (row < 1 || row > 3)
            {
                printf("Error! Enter row between 1 and 3: ");
                scanf("%d", &row);
            }

            target_row = (row - 1) * 2;
            target_col = col(column);
            if (game[target_row][target_col] == ' ')
            {
                break; 
            }
            else
            {
                printf("Square (%d, %d) is already occupied! Try again.\n\n", row, column);
            }
        }

        game[target_row][target_col] = current_player;
        printf("\n");
        for (int i = 0; i < 6; i++)
        {
            for (int j = 0; j < 8; j++)
            {
                printf("%c", game[i][j]);
            }
            printf("\n");
        }
        printf("\n");
    }

    return 0;
}